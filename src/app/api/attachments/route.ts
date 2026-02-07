import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// POST /api/attachments - Upload files for a finance request
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const financeRequestId = formData.get('financeRequestId') as string;
    const category = (formData.get('category') as string) || 'OTHER';

    if (!financeRequestId) {
      return NextResponse.json({ error: 'Finance request ID is required' }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Verify the finance request exists and user has access
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        id: financeRequestId,
        isDeleted: false,
      },
      select: { id: true, requestorId: true },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Finance request not found' }, { status: 404 });
    }

    // Check permission: owner, admin, or finance team
    if (
      financeRequest.requestorId !== user.id &&
      user.role !== 'ADMIN' &&
      user.role !== 'FINANCE_TEAM'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const attachments = [];

    for (const file of files) {
      // Validate file size (max 5MB per file)
      if (file.size > 5 * 1024 * 1024) {
        continue;
      }

      // Read file and convert to base64 data URL
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const fileType = file.type || 'application/octet-stream';
      const dataUrl = `data:${fileType};base64,${base64}`;

      // Create attachment record with data URL
      const attachment = await prisma.attachment.create({
        data: {
          financeRequestId,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          fileUrl: dataUrl,
          category,
          uploadedById: user.id,
        },
      });

      attachments.push({
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        fileUrl: attachment.fileUrl,
        category: attachment.category,
      });
    }

    return NextResponse.json({ attachments }, { status: 201 });
  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

// DELETE /api/attachments?id=xxx - Delete an attachment
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        financeRequest: {
          select: { requestorId: true },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Check permission
    if (
      attachment.financeRequest.requestorId !== user.id &&
      attachment.uploadedById !== user.id &&
      user.role !== 'ADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete
    await prisma.attachment.update({
      where: { id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: 'Attachment deleted' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
