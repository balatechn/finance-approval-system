import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/settings - Get all settings data
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'all';

    let data: any = {};

    if (section === 'all') {
      // Parallelize all queries when fetching everything
      const [departments, costCenters, entities, systemConfig] = await Promise.all([
        prisma.department.findMany({ orderBy: { name: 'asc' } }),
        prisma.costCenter.findMany({ orderBy: { name: 'asc' } }),
        prisma.entity.findMany({ orderBy: { name: 'asc' } }),
        prisma.systemConfig.findMany({ orderBy: { key: 'asc' } }),
      ]);
      data = { departments, costCenters, entities, systemConfig };
    } else {
      if (section === 'departments') {
        data.departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
      } else if (section === 'costCenters') {
        data.costCenters = await prisma.costCenter.findMany({ orderBy: { name: 'asc' } });
      } else if (section === 'entities') {
        data.entities = await prisma.entity.findMany({ orderBy: { name: 'asc' } });
      } else if (section === 'systemConfig') {
        data.systemConfig = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
      }
    }

    const response = NextResponse.json(data);
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST /api/settings - Create a new config item
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { type, ...data } = body;

    let result;

    switch (type) {
      case 'department': {
        const existing = await prisma.department.findFirst({
          where: { OR: [{ name: data.name }, { code: data.code }] },
        });
        if (existing) {
          return NextResponse.json(
            { error: `Department with this ${existing.name === data.name ? 'name' : 'code'} already exists` },
            { status: 400 }
          );
        }
        result = await prisma.department.create({
          data: { name: data.name, code: data.code, headId: data.headId || null },
        });
        break;
      }

      case 'costCenter': {
        const existing = await prisma.costCenter.findUnique({ where: { code: data.code } });
        if (existing) {
          return NextResponse.json({ error: 'Cost center with this code already exists' }, { status: 400 });
        }
        result = await prisma.costCenter.create({
          data: { name: data.name, code: data.code, departmentCode: data.departmentCode || null },
        });
        break;
      }

      case 'entity': {
        const existing = await prisma.entity.findUnique({ where: { code: data.code } });
        if (existing) {
          return NextResponse.json({ error: 'Entity with this code already exists' }, { status: 400 });
        }
        result = await prisma.entity.create({
          data: { name: data.name, code: data.code },
        });
        break;
      }

      case 'systemConfig': {
        const existing = await prisma.systemConfig.findUnique({ where: { key: data.key } });
        if (existing) {
          return NextResponse.json({ error: 'Config key already exists' }, { status: 400 });
        }
        result = await prisma.systemConfig.create({
          data: { key: data.key, value: data.value, description: data.description || null },
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

// PATCH /api/settings - Update a config item
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { type, id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'department': {
        // Check uniqueness if name or code changed
        const conflicts = await prisma.department.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              { OR: [
                ...(data.name ? [{ name: data.name }] : []),
                ...(data.code ? [{ code: data.code }] : []),
              ]},
            ],
          },
        });
        if (conflicts) {
          return NextResponse.json({ error: 'Department name or code already in use' }, { status: 400 });
        }
        result = await prisma.department.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.code && { code: data.code }),
            ...(data.headId !== undefined && { headId: data.headId || null }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        });
        break;
      }

      case 'costCenter': {
        if (data.code) {
          const conflict = await prisma.costCenter.findFirst({
            where: { code: data.code, id: { not: id } },
          });
          if (conflict) {
            return NextResponse.json({ error: 'Cost center code already in use' }, { status: 400 });
          }
        }
        result = await prisma.costCenter.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.code && { code: data.code }),
            ...(data.departmentCode !== undefined && { departmentCode: data.departmentCode || null }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        });
        break;
      }

      case 'entity': {
        if (data.code) {
          const conflict = await prisma.entity.findFirst({
            where: { code: data.code, id: { not: id } },
          });
          if (conflict) {
            return NextResponse.json({ error: 'Entity code already in use' }, { status: 400 });
          }
        }
        result = await prisma.entity.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.code && { code: data.code }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        });
        break;
      }

      case 'systemConfig': {
        result = await prisma.systemConfig.update({
          where: { id },
          data: {
            ...(data.value !== undefined && { value: data.value }),
            ...(data.description !== undefined && { description: data.description }),
          },
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE /api/settings - Delete/deactivate a config item
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ error: 'Type and ID are required' }, { status: 400 });
    }

    switch (type) {
      case 'department':
        await prisma.department.update({ where: { id }, data: { isActive: false } });
        break;
      case 'costCenter':
        await prisma.costCenter.update({ where: { id }, data: { isActive: false } });
        break;
      case 'entity':
        await prisma.entity.update({ where: { id }, data: { isActive: false } });
        break;
      case 'systemConfig':
        await prisma.systemConfig.delete({ where: { id } });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
