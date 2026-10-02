import bcrypt from 'bcryptjs';
import { transporter } from '../utils/email.js';
import { findUserByEmail, createUser, findOtpByEmail, upsertOtp, deleteOtp, updateUser, deleteUser, findAllUsers } from '../models/userModel.js';
import { generateAuthTokens, generateResetToken, verifyResetToken, JWT_REFRESH_SECRET, JWT_ACCESS_SECRET } from '../utils/jwt.js';
import { generateOtpCode, generateOtpExpiry } from '../utils/otp.js';
import jwt from 'jsonwebtoken';

/**
 * Sends a 4-digit One-Time Password (OTP) to the specified email address for account registration.
 * Ensures that the email is not already registered before sending.
 */
export const sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const code = generateOtpCode();
    const expiresAt = generateOtpExpiry(10);

    await upsertOtp(email, code, expiresAt);

    if (transporter) {
      await transporter.sendMail({
        from: '"Karodeal Auth" <2383elonmusk@gmail.com>',
        to: email,
        subject: 'Your Verification Code',
        text: `Your code is: ${code}`,
        html: `<b>Your verification code is: ${code}</b>`
      });
    }

    res.json({ message: 'OTP sent successfully to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

/**
 * Sends a 4-digit One-Time Password (OTP) to the specified email address for password recovery.
 * Verifies that the email exists in the database before sending.
 */
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const existingUser = await findUserByEmail(email);
    if (!existingUser) return res.status(404).json({ error: 'No account found with that email address.' });

    const code = generateOtpCode();
    const expiresAt = generateOtpExpiry(10);

    await upsertOtp(email, code, expiresAt);

    if (transporter) {
      await transporter.sendMail({
        from: '"Karodeal Auth" <2383elonmusk@gmail.com>',
        to: email,
        subject: 'Password Reset Verification Code',
        text: `Your password reset code is: ${code}`,
        html: `<b>Your password reset code is: ${code}</b>`
      });
    }

    res.json({ message: 'Password reset code sent successfully to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reset OTP' });
  }
};

/**
 * Registers a new user.
 * Validates the provided OTP, enforces password strength requirements, hashes the password, 
 * creates the user record, and returns a JSON Web Token (JWT) for authentication.
 */
export const signup = async (req, res) => {
  const { name, email, mobile, password, otp } = req.body;
  if (!email || !password || !otp) return res.status(400).json({ error: 'Email, password, and OTP are required' });

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain a capital letter, small letter, number, and special character.' });
  }

  try {
    const otpRecord = await findOtpByEmail(email);
    if (!otpRecord) return res.status(400).json({ error: 'No OTP found for this email' });
    if (otpRecord.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > otpRecord.expiresAt) return res.status(400).json({ error: 'OTP has expired' });

    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email.toLowerCase() === '2383elonmusk@gmail.com' ? 'ADMIN' : 'USER';
    
    const user = await createUser({
      name, email, mobile, password: hashedPassword,
      role,
      loginCount: 1,
      lastLogin: new Date()
    });

    await deleteOtp(email); // Clean up

    const { token, refreshToken } = generateAuthTokens(user.id);
    res.json({ message: 'User created successfully', token, refreshToken, user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, pendingBalance: user.wallet?.pendingBalance || 0, confirmedBalance: user.wallet?.confirmedBalance || 0, availableBalance: user.wallet?.availableBalance || 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Authenticates an existing user.
 * Compares the provided password with the hashed password in the database and returns a JWT on success.
 */
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });

    await updateUser(user.id, {
      loginCount: { increment: 1 },
      lastLogin: new Date()
    });

    const { token, refreshToken } = generateAuthTokens(user.id);
    res.json({ message: 'Login successful', token, refreshToken, user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, pendingBalance: user.wallet?.pendingBalance || 0, confirmedBalance: user.wallet?.confirmedBalance || 0, availableBalance: user.wallet?.availableBalance || 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to login' });
  }
};

/**
 * Updates the profile information of the currently authenticated user.
 */
export const updateProfile = async (req, res) => {
  const { name, mobile } = req.body;
  const userId = req.userId; // From auth middleware

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const updatedUser = await updateUser(userId, {
      name,
      mobile,
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Retrieves the profile information of the currently authenticated user.
 */
export const getProfile = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await import('../utils/db.js').then(m => m.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } }));
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
          pendingBalance: user.wallet?.pendingBalance || 0,
          confirmedBalance: user.wallet?.confirmedBalance || 0,
          availableBalance: user.wallet?.availableBalance || 0,
        }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

/**
 * Verifies the OTP for password reset and issues a temporary JWT reset token.
 */
export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  try {
    const otpRecord = await findOtpByEmail(email);
    if (!otpRecord) return res.status(400).json({ error: 'No OTP found for this email' });
    if (otpRecord.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > otpRecord.expiresAt) return res.status(400).json({ error: 'OTP has expired' });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // OTP is valid! Issue a short-lived reset token
    const resetToken = generateResetToken(user.id);

    // Clean up OTP so it can't be reused
    await deleteOtp(email);

    res.json({ message: 'OTP verified successfully', resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

/**
 * Resets a user's password using a JWT reset token.
 */
export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Reset token and new password are required' });

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain a capital letter, small letter, number, and special character.' });
  }

  try {
    // Verify the JWT
    const decoded = verifyResetToken(resetToken);
    const userId = decoded.userId;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateUser(userId, { password: hashedPassword });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset session expired. Please request a new OTP.' });
    }
    res.status(500).json({ error: 'Failed to reset password. Invalid token.' });
  }
};

/**
 * Changes the password for the currently authenticated user.
 * Requires the user to provide their current password for security verification.
 */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long and contain a capital letter, small letter, number, and special character.' });
  }

  try {
    const user = await import('../utils/db.js').then(m => m.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } }));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateUser(userId, { password: hashedPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

/**
 * Deletes the currently authenticated user's account.
 */
export const deleteAccount = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await deleteUser(userId);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete Account Error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete account' });
  }
};

/**
 * Verifies if the current token belongs to an administrator.
 * Assumes the request has passed the requireAdmin middleware.
 */
export const verifyAdmin = (req, res) => {
  res.json({ valid: true });
};

/**
 * Refreshes an access token using a valid refresh token.
 */
export const refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'Refresh token is required' });

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    res.json({ token: accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

/**
 * Gets all users (Admin only)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await findAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
};
