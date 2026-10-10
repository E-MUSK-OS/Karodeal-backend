/**
 * Generates a random 6-digit OTP code as a string.
 */
export const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Calculates the expiration date for an OTP based on the current time plus the specified minutes.
 * @param {number} minutes The number of minutes until the OTP expires (default is 10).
 */
export const generateOtpExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60000);
};
