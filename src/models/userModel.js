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
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const normalizedEmail = user.email ? user.email.trim().toLowerCase() : '';

  return await prisma.$transaction(async (tx) => {
    // 1. Delete ticket messages belonging to missing cashback tickets of this user
    await tx.ticketMessage.deleteMany({
      where: {
        ticket: { userId: id }
      }
    });

    // 2. Delete missing cashback tickets
    await tx.missingCashbackTicket.deleteMany({
      where: { userId: id }
    });

    // 3. Delete manual cashback claims
    await tx.cashbackClaim.deleteMany({
      where: { userId: id }
    });

    // 4. Delete payout requests
    await tx.payoutRequest.deleteMany({
      where: { userId: id }
    });

    // 5. Delete wallet transactions
    await tx.transaction.deleteMany({
      where: { userId: id }
    });

    // 6. Delete user wallet
    await tx.wallet.deleteMany({
      where: { userId: id }
    });

    // 7. Delete product click tracking
    await tx.productClick.deleteMany({
      where: { userId: id }
    });

    // 8. Delete Sub-Admin review requests submitted by this user
    await tx.reviewRequest.deleteMany({
      where: { requestedById: id }
    });

    // 9. If user reviewed any review requests as Admin, disassociate reviewer
    await tx.reviewRequest.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null }
    });

    // 10. If user created products as Admin/Sub-Admin, clear createdById to preserve catalog integrity
    await tx.product.updateMany({
      where: { createdById: id },
      data: { createdById: null }
    });

    // 11. Delete all OTP verifications associated with this user's email
    if (normalizedEmail) {
      await tx.otpVerification.deleteMany({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' }
        }
      });

      // 12. Delete contact messages submitted by this email (in Admin > Messages)
      await tx.contactMessage.deleteMany({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' }
        }
      });

      // 13. Delete newsletter subscriber record for this email (in Admin > Subscribers)
      await tx.newsletterSubscriber.deleteMany({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' }
        }
      });
    }

    // 14. Finally, permanently delete the User record
    return await tx.user.delete({
      where: { id }
    });
  });
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
