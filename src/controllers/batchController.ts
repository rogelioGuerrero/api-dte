import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { ingestDteBatch } from '../workflows/batchIngestion';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const logger = createLogger('batchController');

// POST /api/batch/ingest
router.post('/ingest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dtes, passwordPri } = req.body;

    if (!dtes || !Array.isArray(dtes)) {
      throw createError('Invalid input: "dtes" array is required', 400);
    }

    if (dtes.length === 0) {
      throw createError('Batch is empty', 400);
    }

    if (!passwordPri) {
      throw createError('passwordPri is required for signing', 400);
    }

    // Validar estructura básica de cada item
    const invalidItems = dtes.filter((item: any) => !item.dte || !['ventas', 'compras'].includes(item.mode));
    if (invalidItems.length > 0) {
        throw createError('Invalid items in batch. Each item must have "dte" object and "mode" ("ventas" | "compras")', 400);
    }

    logger.info(`Starting batch ingestion of ${dtes.length} items`);
    
    const result = await ingestDteBatch(dtes, passwordPri);
    
    logger.info('Batch ingestion completed', { successful: result.successful, failed: result.failed });

    res.json({
      message: 'Batch processing completed',
      summary: {
        total: dtes.length,
        successful: result.successful,
        failed: result.failed
      },
      errors: result.errors
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/batch/status/:id
router.get('/status/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    logger.info('Getting batch status', { batchId: id });
    
    // TODO: Implement batch status persistence and retrieval
    // For now, return a placeholder as this would require a DB table for batches
    res.json({
      batchId: id,
      status: 'completed', // Dummy status
      message: 'Batch persistence not implemented yet. Process is synchronous for now.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
