import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeAdmin() {
  try {
    const user = await prisma.user.update({
      where: { email: '2383elonmusk@gmail.com' },
      data: { role: 'ADMIN' },
    });
    console.log(`Success! ${user.email} is now an ADMIN.`);
  } catch (err) {
    console.error("Error making user admin:", err);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
