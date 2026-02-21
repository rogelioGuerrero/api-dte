import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { 
  savePushSubscription, 
  removePushSubscription, 
  PushSubscription 
} from '../services/pushService';

const router = Router();
const logger = createLogger('pushController');

// POST /api/push/subscribe
router.post('/subscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { subscription, userAgent } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw createError('Suscripción inválida', 400);
    }

    if (!req.user?.id) {
      throw createError('Usuario no autenticado', 401);
    }

    await savePushSubscription(req.user.id, subscription, userAgent);

    logger.info('Usuario suscrito a push notifications', { 
      userId: req.user.id, 
      endpoint: subscription.endpoint 
    });

    res.json({ 
      success: true, 
      message: 'Suscripción guardada exitosamente' 
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      throw createError('Endpoint requerido', 400);
    }

    await removePushSubscription(endpoint);

    logger.info('Usuario desuscrito de push notifications', { endpoint });

    res.json({ 
      success: true, 
      message: 'Suscripción eliminada exitosamente' 
    });
  } catch (error) {
    next(error);
  }
});

export default router;
