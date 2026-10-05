import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { prisma } from './src/utils/db.js';
import userRoutes from './src/routes/userRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import storeRoutes from './src/routes/storeRoutes.js';
import categoryRoutes from './src/routes/categoryRoutes.js';
import payoutRoutes from './src/routes/payoutRoutes.js';
import missingCashbackRoutes from './src/routes/missingCashbackRoutes.js';
import claimRoutes from './src/routes/claimRoutes.js';
import transactionRoutes from './src/routes/transactionRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import { initCronJobs } from './src/utils/cronJobs.js';
const app = express();
const PORT = process.env.PORT || 5000;

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Karodeal Backend Server is running');
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', message: 'Backend is connected and healthy with Neon database via Prisma.', db: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Database connection failed.', error: error.message });
  }
});

// Use routes
app.use('/api/auth', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/meta/stores', storeRoutes);
app.use('/api/meta/categories', categoryRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/missing-cashback', missingCashbackRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

if (!process.env.VERCEL) {
  initCronJobs();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
