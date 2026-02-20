import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'superadmin@caratlas.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'SuperAdmin123!';
  const existing = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'SUPERADMIN',
        name: 'Super Admin',
      },
    });
    console.log('Created seed Admin:', adminEmail);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
