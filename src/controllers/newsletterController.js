import { prisma } from '../utils/db.js';

/**
 * Subscribes a user to the newsletter
 */
export const subscribe = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Check if already subscribed
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber) {
      return res.status(400).json({ error: 'Email is already subscribed' });
    }

    // Add to database
    await prisma.newsletterSubscriber.create({
      data: { email },
    });

    res.status(201).json({ success: true, message: 'Successfully subscribed to the newsletter!' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Server error while subscribing' });
  }
};

/**
 * Gets all newsletter subscribers (Admin only)
 */
export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, subscribers });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Server error while fetching subscribers' });
  }
};

/**
 * Deletes a subscriber (Admin only)
 */
export const deleteSubscriber = async (req, res) => {
  const { id } = req.params;
  
  try {
    await prisma.newsletterSubscriber.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Subscriber deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: 'Server error while deleting subscriber' });
  }
};
