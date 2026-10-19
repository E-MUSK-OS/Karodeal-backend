import { prisma } from '../utils/db.js';

export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({ 
    where: { email },
    include: { wallet: true }
  });
};

export const findAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const createUser = async (data) => {
  return await prisma.user.create({ 
    data: {
      ...data,
      wallet: {
        create: {}
      }
    },
    include: { wallet: true }
  });
};

export const updateUser = async (id, data) => {
  return await prisma.user.update({
    where: { id },
    data,
  });
};

export const deleteUser = async (id) => {
  return await prisma.$transaction([
    prisma.wallet.deleteMany({ where: { userId: id } }),
    prisma.transaction.deleteMany({ where: { userId: id } }),
    prisma.payoutRequest.deleteMany({ where: { userId: id } }),
    prisma.missingCashbackTicket.deleteMany({ where: { userId: id } }),
    prisma.cashbackClaim.deleteMany({ where: { userId: id } }),
    prisma.productClick.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } })
  ]);
};

export const findOtpByEmail = async (email) => {
  return await prisma.otpVerification.findUnique({ where: { email } });
};

export const upsertOtp = async (email, otp, expiresAt) => {
  return await prisma.otpVerification.upsert({
    where: { email },
    update: { otp, expiresAt },
    create: { email, otp, expiresAt }
  });
};

export const deleteOtp = async (email) => {
  return await prisma.otpVerification.delete({ where: { email } });
};

export const cleanExpiredOtps = async () => {
  try {
    return await prisma.otpVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  } catch (err) {
    console.error('Error cleaning expired OTPs:', err);
  }
};
