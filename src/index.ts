import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import dteController from './controllers/dteController';
import taxController from './controllers/taxController';
import batchController from './controllers/batchController';
import businessController from './controllers/businessController';
import pushController from './controllers/pushController';
import adminController from './controllers/adminController';
import licensingController from './controllers/licensingController';
import testController from './controllers/testController';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('server');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/business', authMiddleware, businessController);
app.use('/api/dte', authMiddleware, dteController);
app.use('/api/tax', authMiddleware, taxController);
app.use('/api/batch', authMiddleware, batchController);
app.use('/api/push', authMiddleware, pushController);
app.use('/api/admin', authMiddleware, adminController);
app.use('/api/licensing', licensingController);
app.use('/api/test', authMiddleware, testController);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 DTE Backend server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
});

export default app;
