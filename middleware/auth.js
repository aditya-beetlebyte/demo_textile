import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';

export function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

export async function verifyJwt(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      const err = new Error('Server misconfiguration');
      err.statusCode = 500;
      throw err;
    }
    const payload = jwt.verify(token, secret);
    const user = await Employee.findById(payload.sub).select('-passwordHash');
    if (!user || !user.isActive) {
      const err = new Error('Invalid or inactive user');
      err.statusCode = 401;
      throw err;
    }
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      e.statusCode = 401;
    }
    next(e);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      return next(err);
    }
    if (!roles.includes(req.user.role)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
}
