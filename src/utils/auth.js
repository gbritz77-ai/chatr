const jwt = require('jsonwebtoken');

function signToken(payload) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function verifyToken(token) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken
};
