import { prisma } from '../utils/db.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

/**
 * Submit a new missing cashback ticket
 */
export const submitTicket = async (req, res) => {
  const userId = req.userId;
  const { storeName, orderDate, orderId, orderAmount, userNote, productId } = req.body;

  if (!storeName || !orderId || !orderAmount) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const finalOrderDate = orderDate ? new Date(orderDate) : new Date();

  let orderScreenshots = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'tickets'));
    orderScreenshots = await Promise.all(uploadPromises);
  }

  // Check if a ticket for this Order ID already exists globally
  const existingTicket = await prisma.missingCashbackTicket.findFirst({
    where: { orderId }
  });

  if (existingTicket) {
    return res.status(400).json({ error: 'A missing cashback ticket for this Order ID has already been submitted.' });
  }

  // Automatically link to product if provided or if matched with a CashbackClaim
  let resolvedProductId = productId || null;
  if (!resolvedProductId) {
    const matchedClaim = await prisma.cashbackClaim.findFirst({
      where: { orderId },
      select: { productId: true }
    });
    if (matchedClaim?.productId) {
      resolvedProductId = matchedClaim.productId;
    }
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
        orderDate: finalOrderDate,
        orderId,
        orderAmount: parseFloat(orderAmount),
        userNote,
        productId: resolvedProductId,
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
        product: { select: { id: true, title: true, image: true, slug: true, cashback: true } },
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
  const { storeName, orderDate, orderId, orderAmount, userNote, productId } = req.body;

  if (!storeName || !orderId || !orderAmount) {
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
        orderDate: orderDate ? new Date(orderDate) : existing.orderDate,
        orderId,
        orderAmount: parseFloat(orderAmount),
        userNote,
        ...(productId !== undefined ? { productId: productId || null } : {})
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
    let where = {};
    if (req.userRole === 'SUB_ADMIN') {
      const subAdminProducts = await prisma.product.findMany({
        where: { createdById: req.userId },
        select: { id: true }
      });
      const subAdminProductIds = subAdminProducts.map(p => p.id);

      const subAdminClaims = await prisma.cashbackClaim.findMany({
        where: { product: { createdById: req.userId } },
        select: { orderId: true }
      });
      const subAdminOrderIds = subAdminClaims.map(c => c.orderId).filter(Boolean);

      where = {
        OR: [
          { productId: { in: subAdminProductIds } },
          { orderId: { in: subAdminOrderIds } }
        ]
      };
    }

    const tickets = await prisma.missingCashbackTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { 
          select: { 
            id: true, 
            title: true, 
            image: true, 
            slug: true, 
            cashback: true, 
            createdById: true,
            createdBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          } 
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Also fetch matched claims for these tickets
    const orderIds = tickets.map(t => t.orderId).filter(Boolean);
    const matchedClaims = orderIds.length > 0 ? await prisma.cashbackClaim.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        id: true,
        ticketId: true,
        status: true,
        awardedCashback: true,
        adminNote: true,
        orderId: true,
        product: { 
          select: { 
            id: true, 
            title: true, 
            cashback: true,
            createdById: true,
            createdBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          } 
        },
        invoiceScreenshot: true,
        reviewScreenshot: true,
        noReturnScreenshot: true,
        createdAt: true
      }
    }) : [];

    const claimsByOrderId = {};
    matchedClaims.forEach(c => {
      claimsByOrderId[c.orderId] = c;
    });

    const ticketsWithClaims = tickets.map(t => ({
      ...t,
      matchedClaim: claimsByOrderId[t.orderId] || null
    }));

    res.json({ success: true, tickets: ticketsWithClaims });
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
  const { status, adminNote, awardedCashback } = req.body;

  if (!['PENDING', 'RESOLVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const existingTicket = await prisma.missingCashbackTicket.findUnique({
      where: { id },
      include: { product: true }
    });
    if (!existingTicket) return res.status(404).json({ error: 'Ticket not found' });

    if (existingTicket.status !== 'PENDING') {
      return res.status(400).json({ error: 'This ticket has already been processed. Once resolved or rejected, it cannot be modified.' });
    }

    if (!['RESOLVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status can only be updated to RESOLVED or REJECTED.' });
    }

    if (status === 'REJECTED' && (!adminNote || !adminNote.trim())) {
      return res.status(400).json({ error: 'Admin note / reason is compulsory when rejecting a ticket.' });
    }

    const trimmedAdminNote = adminNote && adminNote.trim() ? adminNote.trim() : null;

    if (req.userRole === 'SUB_ADMIN') {
      const isProductAuthor = existingTicket.product?.createdById === req.userId;
      const isClaimAuthor = await prisma.cashbackClaim.findFirst({
        where: { orderId: existingTicket.orderId, product: { createdById: req.userId } }
      });

      if (!isProductAuthor && !isClaimAuthor) {
        return res.status(403).json({ error: 'Forbidden: You can only manage tickets for your own products.' });
      }
    }

    const matchedClaim = await prisma.cashbackClaim.findFirst({
      where: { orderId: existingTicket.orderId }
    });

    // If resolving and cashback amount is provided, credit wallet & approve claim
    if (status === 'RESOLVED' && awardedCashback !== undefined && awardedCashback !== null && String(awardedCashback).trim() !== '') {
      const cashbackAmt = parseFloat(awardedCashback);
      if (isNaN(cashbackAmt) || cashbackAmt < 0) {
        return res.status(400).json({ error: 'Invalid cashback amount' });
      }

      if (cashbackAmt > 0) {
        if (matchedClaim?.status === 'APPROVED') {
          return res.status(400).json({
            error: `Claim for Order #${existingTicket.orderId} is already approved with ₹${matchedClaim.awardedCashback}. Cannot credit twice.`
          });
        }

        await prisma.$transaction(async (tx) => {
          // 1. Update ticket
          await tx.missingCashbackTicket.update({
            where: { id },
            data: { status, adminNote: trimmedAdminNote }
          });

          // 2. If matched claim exists, update it to APPROVED
          if (matchedClaim) {
            await tx.cashbackClaim.update({
              where: { id: matchedClaim.id },
              data: {
                status: 'APPROVED',
                awardedCashback: cashbackAmt,
                adminNote: trimmedAdminNote || `Approved via Missing Cashback Ticket #${existingTicket.ticketId || existingTicket.id.slice(-6).toUpperCase()}`
              }
            });
          }

          // 3. Update User Wallet
          await tx.wallet.upsert({
            where: { userId: existingTicket.userId },
            create: {
              userId: existingTicket.userId,
              confirmedBalance: cashbackAmt,
              availableBalance: cashbackAmt
            },
            update: {
              confirmedBalance: { increment: cashbackAmt },
              availableBalance: { increment: cashbackAmt }
            }
          });

          // 4. Create Transaction record
          await tx.transaction.create({
            data: {
              userId: existingTicket.userId,
              amount: cashbackAmt,
              type: 'EARNING',
              status: 'CONFIRMED',
              description: matchedClaim 
                ? `Cashback Claim Approved via Ticket (#${existingTicket.orderId})`
                : `Missing Cashback Awarded for Order #${existingTicket.orderId}`,
              storeName: existingTicket.storeName,
              orderId: existingTicket.orderId
            }
          });
        });

        return res.json({ 
          success: true, 
          message: `Ticket resolved and ₹${cashbackAmt} cashback credited to user wallet successfully.` 
        });
      }
    }

    // Default update (e.g. without crediting money or changing to REJECTED)
    const ticket = await prisma.missingCashbackTicket.update({
      where: { id },
      data: { status, adminNote: trimmedAdminNote }
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
    const ticket = await prisma.missingCashbackTicket.findUnique({
      where: { id },
      include: { product: true }
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (ticket.status !== 'PENDING') {
      return res.status(400).json({ error: 'This ticket has been finalized and is closed for new messages.' });
    }

    // Auth validation handled by routes
    if (sender === 'USER' && ticket.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (sender === 'ADMIN' && req.userRole === 'SUB_ADMIN') {
      const isProductAuthor = ticket.product?.createdById === req.userId;
      const isClaimAuthor = await prisma.cashbackClaim.findFirst({
        where: { orderId: ticket.orderId, product: { createdById: req.userId } }
      });

      if (!isProductAuthor && !isClaimAuthor) {
        return res.status(403).json({ error: 'Forbidden: You can only message on tickets for your own products.' });
      }
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
