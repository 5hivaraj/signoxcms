exports.requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: no user found' });
    }

    // Handle both single role and array of roles
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Forbidden: insufficient rights',
        required: allowedRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};
