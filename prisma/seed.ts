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

  // Update old users to new emails (handles migration from old seed data)
  const emailMigrations = [
    { oldEmail: 'md@nationalconsultingindia.com', newEmail: 'shahil@nationalgroupindia.com', newName: 'Shahil' },
    { oldEmail: 'director@nationalconsultingindia.com', newEmail: 'faisal@nationalgroupindia.com', newName: 'Faisal' },
    { oldEmail: 'fc@nationalconsultingindia.com', newEmail: 'farooq@nationalgroupindia.com', newName: 'Farooq' },
    { oldEmail: 'finance@nationalconsultingindia.com', newEmail: 'karthik@nationalgroupindia.com', newName: 'Karthik' },
    { oldEmail: 'employee@nationalconsultingindia.com', newEmail: 'employee@nationalgroupindia.com', newName: 'Employee Demo' },
  ];

  for (const migration of emailMigrations) {
    const existing = await prisma.user.findUnique({ where: { email: migration.oldEmail } });
    if (existing) {
      await prisma.user.update({
        where: { email: migration.oldEmail },
        data: { email: migration.newEmail, name: migration.newName, password: hashedPassword },
      });
      console.log(`  Migrated ${migration.oldEmail} → ${migration.newEmail}`);
    }
  }

  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'bala@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'bala@nationalgroupindia.com',
      name: 'Bala',
      password: hashedPassword,
      role: Role.ADMIN,
      department: 'Management',
      employeeId: 'EMP001',
      isActive: true,
    },
  });
  console.log('✅ Admin user created');

  // Create Managing Director
  const md = await prisma.user.upsert({
    where: { email: 'shahil@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'shahil@nationalgroupindia.com',
      name: 'Shahil',
      password: hashedPassword,
      role: Role.MD,
      department: 'Management',
      employeeId: 'EMP002',
      isActive: true,
    },
  });
  console.log('✅ MD created');

  // Create Director
  const director = await prisma.user.upsert({
    where: { email: 'faisal@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'faisal@nationalgroupindia.com',
      name: 'Faisal',
      password: hashedPassword,
      role: Role.DIRECTOR,
      department: 'Management',
      employeeId: 'EMP003',
      isActive: true,
    },
  });
  console.log('✅ Director created');

  // Create Finance Controller
  const financeController = await prisma.user.upsert({
    where: { email: 'farooq@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'farooq@nationalgroupindia.com',
      name: 'Farooq',
      password: hashedPassword,
      role: Role.FINANCE_CONTROLLER,
      department: 'Finance',
      employeeId: 'EMP004',
      isActive: true,
    },
  });
  console.log('✅ Finance Controller created');

  // Create Finance Team Member (Vetting & Disbursement)
  const financeTeam = await prisma.user.upsert({
    where: { email: 'karthik@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'karthik@nationalgroupindia.com',
      name: 'Karthik',
      password: hashedPassword,
      role: Role.FINANCE_TEAM,
      department: 'Finance',
      employeeId: 'EMP005',
      isActive: true,
    },
  });
  console.log('✅ Finance Team member (Karthik) created');

  // Create Finance Team Member 2 (Disbursement)
  const financeTeam2 = await prisma.user.upsert({
    where: { email: 'prasanna@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'prasanna@nationalgroupindia.com',
      name: 'Prasanna',
      password: hashedPassword,
      role: Role.FINANCE_TEAM,
      department: 'Finance',
      employeeId: 'EMP007',
      isActive: true,
    },
  });
  console.log('✅ Finance Team member (Prasanna) created');

  // Create Employee (demo)
  const employee = await prisma.user.upsert({
    where: { email: 'employee@nationalgroupindia.com' },
    update: {},
    create: {
      email: 'employee@nationalgroupindia.com',
      name: 'Employee Demo',
      password: hashedPassword,
      role: Role.EMPLOYEE,
      department: 'Sales',
      employeeId: 'EMP006',
      isActive: true,
    },
  });
  console.log('✅ Employee created');

  // Create System Config
  const configs = [
    { key: 'SLA_FINANCE_VETTING_HOURS', value: '72', description: 'SLA hours for Finance vetting' },
    { key: 'SLA_FINANCE_VETTING_CRITICAL_HOURS', value: '24', description: 'SLA hours for Finance vetting (Critical)' },
    { key: 'SLA_FINANCE_CONTROLLER_HOURS', value: '24', description: 'SLA hours for Finance Controller approval' },
    { key: 'SLA_DIRECTOR_HOURS', value: '24', description: 'SLA hours for Director approval' },
    { key: 'SLA_MD_HOURS', value: '24', description: 'SLA hours for MD approval' },
    { key: 'SLA_DISBURSEMENT_HOURS', value: '24', description: 'SLA hours for Disbursement processing' },
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
  console.log('Admin:              bala@nationalgroupindia.com');
  console.log('MD:                 shahil@nationalgroupindia.com');
  console.log('Director:           faisal@nationalgroupindia.com');
  console.log('Finance Controller: farooq@nationalgroupindia.com');
  console.log('Finance (Vetting):  karthik@nationalgroupindia.com');
  console.log('Finance (Disbmnt):  prasanna@nationalgroupindia.com');
  console.log('Employee:           employee@nationalgroupindia.com');
  console.log('Password:           Password@123');
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
