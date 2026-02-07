import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Departments
  const departments = [
    { name: 'Sales', code: 'SALES' },
    { name: 'Marketing', code: 'MARKETING' },
    { name: 'Operations', code: 'OPERATIONS' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Finance', code: 'FINANCE' },
    { name: 'Administration', code: 'ADMIN' },
    { name: 'Procurement', code: 'PROCUREMENT' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log('✅ Departments created');

  // Create Cost Centers
  const costCenters = [
    { name: 'Sales Operations', code: 'CC001-SALES', departmentCode: 'SALES' },
    { name: 'Marketing Campaigns', code: 'CC002-MARKETING', departmentCode: 'MARKETING' },
    { name: 'Operations Management', code: 'CC003-OPS', departmentCode: 'OPERATIONS' },
    { name: 'IT Infrastructure', code: 'CC004-IT', departmentCode: 'IT' },
    { name: 'HR Administration', code: 'CC005-HR', departmentCode: 'HR' },
    { name: 'Finance & Accounts', code: 'CC006-FIN', departmentCode: 'FINANCE' },
    { name: 'General Administration', code: 'CC007-ADMIN', departmentCode: 'ADMIN' },
    { name: 'Procurement & Sourcing', code: 'CC008-PROC', departmentCode: 'PROCUREMENT' },
  ];

  for (const cc of costCenters) {
    await prisma.costCenter.upsert({
      where: { code: cc.code },
      update: {},
      create: cc,
    });
  }
  console.log('✅ Cost Centers created');

  // Create Entities
  const entities = [
    { name: 'National Consulting India Pvt Ltd', code: 'NCI-IN' },
    { name: 'National Consulting International', code: 'NCI-INTL' },
  ];

  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { code: entity.code },
      update: {},
      create: entity,
    });
  }
  console.log('✅ Entities created');

  // Hash password
  const hashedPassword = await bcrypt.hash('Password@123', 12);

  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'admin@nationalconsultingindia.com',
      name: 'System Administrator',
      password: hashedPassword,
      role: Role.ADMIN,
      department: 'IT',
      employeeId: 'EMP001',
      isActive: true,
    },
  });
  console.log('✅ Admin user created');

  // Create Finance Head
  const financeHead = await prisma.user.upsert({
    where: { email: 'financehead@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'financehead@nationalconsultingindia.com',
      name: 'Finance Head',
      password: hashedPassword,
      role: Role.FINANCE_HEAD,
      department: 'Finance',
      employeeId: 'EMP002',
      isActive: true,
    },
  });
  console.log('✅ Finance Head created');

  // Create Finance Team Member
  const financeTeam = await prisma.user.upsert({
    where: { email: 'finance@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'finance@nationalconsultingindia.com',
      name: 'Finance Executive',
      password: hashedPassword,
      role: Role.FINANCE_TEAM,
      department: 'Finance',
      employeeId: 'EMP003',
      managerId: financeHead.id,
      isActive: true,
    },
  });
  console.log('✅ Finance Team member created');

  // Create Department Head
  const deptHead = await prisma.user.upsert({
    where: { email: 'hod.sales@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'hod.sales@nationalconsultingindia.com',
      name: 'Sales Department Head',
      password: hashedPassword,
      role: Role.DEPARTMENT_HEAD,
      department: 'Sales',
      employeeId: 'EMP004',
      isActive: true,
    },
  });
  console.log('✅ Department Head created');

  // Create Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'manager@nationalconsultingindia.com',
      name: 'Sales Manager',
      password: hashedPassword,
      role: Role.MANAGER,
      department: 'Sales',
      employeeId: 'EMP005',
      managerId: deptHead.id,
      isActive: true,
    },
  });
  console.log('✅ Manager created');

  // Create Employee
  const employee = await prisma.user.upsert({
    where: { email: 'employee@nationalconsultingindia.com' },
    update: {},
    create: {
      email: 'employee@nationalconsultingindia.com',
      name: 'John Smith',
      password: hashedPassword,
      role: Role.EMPLOYEE,
      department: 'Sales',
      employeeId: 'EMP006',
      managerId: manager.id,
      isActive: true,
    },
  });
  console.log('✅ Employee created');

  // Create System Config
  const configs = [
    { key: 'SLA_MANAGER_HOURS', value: '24', description: 'SLA hours for Manager approval' },
    { key: 'SLA_HOD_HOURS', value: '24', description: 'SLA hours for HOD approval' },
    { key: 'SLA_FINANCE_CRITICAL_HOURS', value: '24', description: 'SLA hours for Finance vetting (Critical)' },
    { key: 'SLA_FINANCE_NON_CRITICAL_HOURS', value: '72', description: 'SLA hours for Finance vetting (Non-Critical)' },
    { key: 'SLA_FINAL_APPROVAL_HOURS', value: '24', description: 'SLA hours for Final approval' },
    { key: 'REFERENCE_PREFIX', value: 'FIN', description: 'Prefix for reference numbers' },
    { key: 'HIGH_VALUE_THRESHOLD', value: '500000', description: 'High value transaction threshold' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log('✅ System config created');

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Test Accounts:');
  console.log('─────────────────────────────────────────');
  console.log('Admin:        admin@nationalconsultingindia.com');
  console.log('Finance Head: financehead@nationalconsultingindia.com');
  console.log('Finance:      finance@nationalconsultingindia.com');
  console.log('HOD:          hod.sales@nationalconsultingindia.com');
  console.log('Manager:      manager@nationalconsultingindia.com');
  console.log('Employee:     employee@nationalconsultingindia.com');
  console.log('Password:     Password@123');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
