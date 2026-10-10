import nodemailer from 'nodemailer';
import 'dotenv/config';

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'karodeal26@gmail.com',
    pass: process.env.SMTP_PASS // You need an App Password from Google here
  }
});

// Verify connection configuration is disabled globally to prevent slow cold starts
// and EAUTH errors crashing the server. You can verify it manually if needed.

export { transporter };
