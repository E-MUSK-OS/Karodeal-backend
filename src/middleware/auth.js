import { PrismaClient } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';

const prisma = new PrismaClient();

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Administrator access required' });
    }

    req.userId = decoded.userId;
    req.userRole = user.role;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireMainAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Main Administrator access required' });
    }

    req.userId = decoded.userId;
    req.userRole = user.role;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(token);
      req.userId = decoded.userId;
    } catch (err) {}
  }
  next();
};

/**
 * Middleware that allows Main Admin unconditionally, and permits Sub-Admin if they have been
 * granted permission for the specified dashboard module and CRUD action (add/update/delete).
 */
export const requireModuleAccess = (moduleName, requiredAction = null) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
        return res.status(403).json({ error: 'Forbidden: Administrator access required' });
      }

      req.userId = decoded.userId;
      req.userRole = user.role;
      req.user = user;

      // Main Admin has unrestricted access to all modules and operations
      if (user.role === 'ADMIN') {
        return next();
      }

      // Sub-Admin: check permission for this module
      if (user.role === 'SUB_ADMIN') {
        let allowed = ['dashboard', 'products', 'billing', 'review-requests', 'clicks'];
        let perms = { canAdd: true, canUpdate: true, canDelete: false };

        try {
          const rows = await prisma.$queryRawUnsafe(
            'SELECT allowed_modules, can_add, can_update, can_delete FROM sub_admin_permissions WHERE user_id = $1 LIMIT 1',
            user.id
          );
          if (rows && rows.length > 0) {
            const row = rows[0];
            allowed = Array.isArray(row.allowed_modules) 
              ? row.allowed_modules 
              : (typeof row.allowed_modules === 'string' ? JSON.parse(row.allowed_modules) : allowed);
            perms = { 
              canAdd: Boolean(row.can_add), 
              canUpdate: Boolean(row.can_update), 
              canDelete: Boolean(row.can_delete) 
            };
          }
        } catch (dbErr) {
          console.error('Error fetching sub admin perms in middleware:', dbErr);
        }

        req.permissions = perms;

        // Check module access
        if (moduleName && !allowed.includes(moduleName)) {
          return res.status(403).json({ error: `Forbidden: You do not have permission to access the ${moduleName} module` });
        }

        // Check CRUD action permission if specified
        if (requiredAction === 'add' && !perms.canAdd) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to add or create records' });
        }
        if (requiredAction === 'update' && !perms.canUpdate) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to update or edit records' });
        }
        if (requiredAction === 'delete' && !perms.canDelete) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to delete records' });
        }

        return next();
      }

      return res.status(403).json({ error: 'Forbidden: Unauthorized' });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  };
};

