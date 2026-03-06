// const jwt = require('jsonwebtoken');

// exports.requireAuth = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ message: 'Authorization token missing' });
//   }

//   const token = authHeader.split(' ')[1];

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // { userId, role }
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: 'Invalid or expired token' });
//   }
// };

const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - Invalid token format' });
    }

    try {
      // Verify JWT (this already checks expiration)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch full user with hierarchy
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          clientProfile: true,
          managedByClientAdmin: {
            include: { clientProfile: true },
          },
          createdByUserAdmin: {
            include: {
              managedByClientAdmin: {
                include: { clientProfile: true },
              },
            },
          },
        },
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'User account is inactive' });
      }

      // =========================
      // LICENSE CHECK SECTION
      // =========================
      let clientProfileToCheck = null;

      if (user.role === 'CLIENT_ADMIN') {
        clientProfileToCheck = user.clientProfile;
      }

      if (user.role === 'USER_ADMIN') {
        clientProfileToCheck = user.managedByClientAdmin?.clientProfile || null;
      }

      if (user.role === 'STAFF') {
        clientProfileToCheck =
          user.createdByUserAdmin?.managedByClientAdmin?.clientProfile || null;
      }

      if (clientProfileToCheck) {
        if (!clientProfileToCheck.isActive) {
          return res.status(403).json({
            message: 'Your organization license is suspended. Please contact support.',
          });
        }

        if (
          clientProfileToCheck.licenseExpiry &&
          new Date(clientProfileToCheck.licenseExpiry) < new Date()
        ) {
          return res.status(403).json({
            message: 'Your organization license has expired. Please contact your administrator.',
          });
        }
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        staffRole: user.staffRole,
        clientProfile: user.clientProfile,
        managedByClientAdminId: user.managedByClientAdminId,
        createdByUserAdminId: user.createdByUserAdminId,
      };

      // Optional logging (avoid spam from polling endpoints)
      const isPollingEndpoint =
        req.path.includes('/heartbeat') ||
        req.path.includes('/config') ||
        req.path.includes('/check-status');

      if (!isPollingEndpoint && process.env.NODE_ENV !== 'production') {
        console.log('✅ Authenticated:', user.email, user.role);
      }

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      return res.status(401).json({ message: 'Token verification failed' });
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

/**
 * Require SUPER_ADMIN
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      message: 'Forbidden: Requires SUPER_ADMIN role',
    });
  }
  next();
};

/**
 * Require any admin
 */
const requireAnyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const allowedRoles = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'USER_ADMIN'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Forbidden: Requires one of these roles: ${allowedRoles.join(', ')}`,
    });
  }
  next();
};

/**
 * Require content management access
 */
const requireContentManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'USER_ADMIN') {
    return next();
  }
  if (
    req.user.role === 'STAFF' &&
    ['CONTENT_MANAGER', 'BROADCAST_MANAGER'].includes(req.user.staffRole)
  ) {
    return next();
  }
  return res.status(403).json({
    message: 'Forbidden: Content management access required',
  });
};

/**
 * Require content view access
 * Allows: CLIENT_ADMIN, USER_ADMIN, and STAFF with content roles
 */
const requireContentViewAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // CLIENT_ADMIN can view content for their organization
  if (req.user.role === 'CLIENT_ADMIN') {
    return next();
  }
  // USER_ADMIN can view content for their team
  if (req.user.role === 'USER_ADMIN') {
    return next();
  }
  // STAFF with content roles can view content
  if (
    req.user.role === 'STAFF' &&
    ['CONTENT_MANAGER', 'BROADCAST_MANAGER', 'CMS_VIEWER'].includes(req.user.staffRole)
  ) {
    return next();
  }
  return res.status(403).json({
    message: 'Forbidden: Content viewing access required',
  });
};

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireAnyAdmin,
  requireContentManagement,
  requireContentViewAccess,
};
