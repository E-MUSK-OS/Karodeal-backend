import { prisma } from '../utils/db.js';
import { transporter } from '../utils/email.js';

export const submitContactForm = async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // 1. Save to database
    const newContactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        message,
      },
    });

    // 2. Send email notification to Admin (process.env.SMTP_USER)
    const adminEmail = process.env.SMTP_USER;
    if (adminEmail) {
      const subject = `New Contact Message from ${name}`;
      const emailBody = `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `;
      // Send the email to the admin
      await transporter.sendMail({
        from: `KaroDeal Contact <${process.env.SMTP_USER}>`,
        to: adminEmail,
        replyTo: email, // This allows the admin to hit 'Reply' and reply directly to the user
        subject: subject,
        html: emailBody
      }).catch(err => {
        console.error("Failed to send admin notification email:", err);
      });
    }

    res.status(201).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Server error while submitting message' });
  }
};

export const getContactMessages = async (req, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
};

export const deleteContactMessage = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.contactMessage.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact message:', error);
    res.status(500).json({ error: 'Server error while deleting message' });
  }
};
