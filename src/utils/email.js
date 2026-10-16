import nodemailer from 'nodemailer';
import 'dotenv/config';

// Sanitize password by stripping any accidental whitespace/formatting spaces from Google App Password
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

// Create a transporter using Gmail with connection pooling for faster responses and lower latency
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  rateLimit: 10,
  auth: {
    user: process.env.SMTP_USER || 'karodeal26@gmail.com',
    pass: smtpPass
  }
});

export { transporter };

