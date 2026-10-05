import { prisma } from '../utils/db.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

/**
 * Submit a new missing cashback ticket
 */
export const submitTicket = async (req, res) => {
  const userId = req.userId;
  const { storeName, orderDate, orderId, orderAmount, userNote } = req.body;

  if (!storeName || !orderDate || !orderId || !orderAmount) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  let orderScreenshots = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'tickets'));
    orderScreenshots = await Promise.all(uploadPromises);
  }

  // Generate 6-character random alphanumeric ticketId
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ticketId = '';
  for (let i = 0; i < 6; i++) {
    ticketId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  try {
    const ticket = await prisma.missingCashbackTicket.create({
      data: {
        ticketId,
        userId,
        storeName,
        orderDate: new Date(orderDate),
        orderId,
        orderAmount: parseFloat(orderAmount),
        userNote,
        status: 'PENDING',
        orderScreenshots
      }
    });

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error submitting missing cashback ticket:', error);
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
};

/**
 * Get all missing cashback tickets for the logged-in user
 */
export const getUserTickets = async (req, res) => {
  const userId = req.userId;

  try {
    const tickets = await prisma.missingCashbackTicket.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

/**
 * Update an existing missing cashback ticket (User only, if pending)
 */
export const updateUserTicket = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { storeName, orderDate, orderId, orderAmount, userNote } = req.body;

  if (!storeName || !orderDate || !orderId || !orderAmount) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    const existing = await prisma.missingCashbackTicket.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Only pending tickets can be edited' });

    const ticket = await prisma.missingCashbackTicket.update({
      where: { id },
      data: {
        storeName,
        orderDate: new Date(orderDate),
        orderId,
        orderAmount: parseFloat(orderAmount),
        userNote
      }
    });

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
};

/**
 * [ADMIN] Get all missing cashback tickets
 */
export const getAllTickets = async (req, res) => {
  try {
    const tickets = await prisma.missingCashbackTicket.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

/**
 * [ADMIN] Update missing cashback ticket status
 */
export const updateTicketStatus = async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  if (!['PENDING', 'RESOLVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const ticket = await prisma.missingCashbackTicket.update({
      where: { id },
      data: { status, adminNote }
    });

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
};

/**
 * Add a message to an existing ticket
 */
export const addMessage = async (req, res) => {
  const { id } = req.params;
  const { message, sender } = req.body; // sender should be 'USER' or 'ADMIN'

  if ((!message && !req.file) || !sender) {
    return res.status(400).json({ error: 'Message or attachment, and sender are required' });
  }

  let attachmentUrl = null;
  if (req.file) {
    attachmentUrl = await uploadToCloudinary(req.file.buffer, 'tickets/messages');
  }

  try {
    const ticket = await prisma.missingCashbackTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Auth validation handled by routes
    if (sender === 'USER' && ticket.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        message: message || '',
        sender,
        attachment: attachmentUrl
      }
    });

    // Update unread flags
    await prisma.missingCashbackTicket.update({
      where: { id },
      data: {
        adminUnread: sender === 'USER' ? true : false,
        userUnread: sender === 'ADMIN' ? true : false,
      }
    });

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
};

/**
 * Mark ticket as read by User
 */
export const markUserRead = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.missingCashbackTicket.update({
      where: { id, userId: req.userId },
      data: { userUnread: false }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Failed to mark read' });
  }
};

/**
 * [ADMIN] Mark ticket as read by Admin
 */
export const markAdminRead = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.missingCashbackTicket.update({
      where: { id },
      data: { adminUnread: false }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Failed to mark read' });
  }
};
