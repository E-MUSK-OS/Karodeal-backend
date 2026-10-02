import nodemailer from 'nodemailer';
import 'dotenv/config';

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || '2383elonmusk@gmail.com',
    pass: process.env.SMTP_PASS // You need an App Password from Google here
  }
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP Connection Error: ', error);
  } else {
    console.log('SMTP Server is ready to take our messages');
  }
});

export { transporter };
