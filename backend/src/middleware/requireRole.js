const { HttpError } = require('../errors');

const ranks = { viewer: 1, editor: 2, admin: 3 };

function requireRole(minimumRole) {
  return (req, _res, next) => {
    if (!req.user || !ranks[req.user.role] || ranks[req.user.role] < ranks[minimumRole]) {
      return next(new HttpError(403, 'FORBIDDEN', `${minimumRole} role required`));
    }
    next();
  };
}

module.exports = requireRole;
