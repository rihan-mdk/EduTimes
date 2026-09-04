function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({ error: `Forbidden: requires ${requiredRole} access privileges.` });
    }

    next();
  };
}

module.exports = { requireRole };
