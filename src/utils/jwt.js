import jwt from 'jsonwebtoken';

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'karodeal_access_$111$2383$x7L2vB';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'karodeal_refresh_$111$2383$m9W1q';
export const JWT_RESETPASSWORD_SECRET = process.env.JWT_RESETPASSWORD_SECRET || 'karodeal_resetpass_$111$2383$z4T';

/**
 * Generates an access token and a refresh token for a user.
 */
export const generateAuthTokens = (userId) => {
  const token = jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { token, refreshToken };
};

/**
 * Generates a short-lived reset token for password recovery.
 */
export const generateResetToken = (userId) => {
  return jwt.sign({ userId }, JWT_RESETPASSWORD_SECRET, { expiresIn: '15m' });
};

/**
 * Verifies a reset token and returns the decoded payload.
 */
export const verifyResetToken = (token) => {
  return jwt.verify(token, JWT_RESETPASSWORD_SECRET);
};

/**
 * Verifies an access token and returns the decoded payload.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET);
};
