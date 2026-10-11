import cron from 'node-cron';
import { prisma } from './db.js';

export const initCronJobs = () => {
  // Run every hour to check for clicks older than 24 hours
  cron.schedule('0 * * * *', async () => {


    try {
      // Also cleanup resolved and rejected missing cashback tickets older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const ticketResult = await prisma.missingCashbackTicket.deleteMany({
        where: {
          status: {
            in: ['RESOLVED', 'REJECTED']
          },
          updatedAt: {
            lt: sevenDaysAgo
          }
        }
      });
      
      if (ticketResult.count > 0) {
        console.log(`[Cron] Ticket cleanup complete. Deleted ${ticketResult.count} old closed tickets.`);
      }
    } catch (error) {
      console.error('[Cron] Error during ticket cleanup:', error);
    }
  });

  // Auto-deactivate expired product cards every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const result = await prisma.product.updateMany({
        where: {
          isActive: true,
          expiresAt: {
            not: null,
            lte: now
          }
        },
        data: {
          isActive: false
        }
      });
      if (result.count > 0) {
        console.log(`[Cron] Auto-deactivated ${result.count} expired product card(s).`);
      }
    } catch (error) {
      console.error('[Cron] Error auto-deactivating expired products:', error);
    }
  });

  console.log('[Cron] Background cleanup & auto-deactivation jobs initialized.');
};

