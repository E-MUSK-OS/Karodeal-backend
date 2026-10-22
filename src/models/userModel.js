import { prisma } from '../utils/db.js';

export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({ 
    where: { email },
    include: { wallet: true }
  });
};

export const DEFAULT_SUB_ADMIN_PERMISSIONS = {
  allowedModules: ['dashboard', 'products', 'billing', 'review-requests', 'clicks'],
  canAdd: true,
  canUpdate: true,
  canDelete: false
};

export const getSubAdminPermissions = async (userId) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM sub_admin_permissions WHERE user_id = $1 LIMIT 1',
      userId
    );
    if (rows && rows.length > 0) {
      const p = rows[0];
      return {
        allowedModules: Array.isArray(p.allowed_modules) 
          ? p.allowed_modules 
          : (typeof p.allowed_modules === 'string' ? JSON.parse(p.allowed_modules) : DEFAULT_SUB_ADMIN_PERMISSIONS.allowedModules),
        canAdd: Boolean(p.can_add),
        canUpdate: Boolean(p.can_update),
        canDelete: Boolean(p.can_delete)
      };
    }
  } catch (err) {
    console.error('Error fetching sub-admin permissions:', err);
  }
  return { ...DEFAULT_SUB_ADMIN_PERMISSIONS };
};

export const upsertSubAdminPermissions = async (userId, { allowedModules, canAdd, canUpdate, canDelete }) => {
  const safeModules = Array.isArray(allowedModules) ? allowedModules : DEFAULT_SUB_ADMIN_PERMISSIONS.allowedModules;
  const modulesJson = JSON.stringify(safeModules);
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO sub_admin_permissions (user_id, allowed_modules, can_add, can_update, can_delete, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       allowed_modules = EXCLUDED.allowed_modules,
       can_add = EXCLUDED.can_add,
       can_update = EXCLUDED.can_update,
       can_delete = EXCLUDED.can_delete,
       updated_at = NOW()
     RETURNING *`,
    userId,
    modulesJson,
    canAdd !== undefined ? Boolean(canAdd) : true,
    canUpdate !== undefined ? Boolean(canUpdate) : true,
    canDelete !== undefined ? Boolean(canDelete) : false
  );

  const p = rows[0];
  return {
    allowedModules: Array.isArray(p.allowed_modules) 
      ? p.allowed_modules 
      : (typeof p.allowed_modules === 'string' ? JSON.parse(p.allowed_modules) : safeModules),
    canAdd: Boolean(p.can_add),
    canUpdate: Boolean(p.can_update),
    canDelete: Boolean(p.can_delete)
  };
};

export const findAllUsers = async () => {
  const users = await prisma.user.findMany({
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

  try {
    const rawPerms = await prisma.$queryRawUnsafe('SELECT * FROM sub_admin_permissions');
    const permMap = new Map();
    for (const p of rawPerms) {
      permMap.set(p.user_id, {
        allowedModules: Array.isArray(p.allowed_modules) 
          ? p.allowed_modules 
          : (typeof p.allowed_modules === 'string' ? JSON.parse(p.allowed_modules) : DEFAULT_SUB_ADMIN_PERMISSIONS.allowedModules),
        canAdd: Boolean(p.can_add),
        canUpdate: Boolean(p.can_update),
        canDelete: Boolean(p.can_delete)
      });
    }

    return users.map(u => ({
      ...u,
      permissions: permMap.get(u.id) || (u.role === 'SUB_ADMIN' ? { ...DEFAULT_SUB_ADMIN_PERMISSIONS } : null)
    }));
  } catch (err) {
    console.error('Error fetching permissions for users:', err);
    return users;
  }
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

    // 14. Delete sub_admin_permissions for this user
    await tx.$executeRawUnsafe(`DELETE FROM sub_admin_permissions WHERE user_id = $1`, id).catch(() => {});

    // 15. Finally, permanently delete the User record
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
