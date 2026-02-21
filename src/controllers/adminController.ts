import { Router, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { broadcastMessage, BroadcastRequest } from '../services/pushService';
import crypto from 'crypto';

const router = Router();
const logger = createLogger('adminController');

// Middleware para verificar rol de admin
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    throw createError('Acceso denegado - se requiere rol de administrador', 403);
  }
  next();
};

// POST /api/admin/broadcast
router.post('/broadcast', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, body, url, target } = req.body;
    
    // Validaciones
    if (!title || !body) {
      throw createError('Título y cuerpo son requeridos', 400);
    }

    if (!target || (target !== 'all' && !Array.isArray(target))) {
      throw createError('Target debe ser "all" o un array de user_ids', 400);
    }

    if (!req.user?.id) {
      throw createError('Usuario no autenticado', 401);
    }

    const broadcastRequest: BroadcastRequest = {
      title,
      body,
      url: url || '/',
      target
    };

    const result = await broadcastMessage(broadcastRequest, req.user.id);

    logger.info('Broadcast enviado', { 
      adminId: req.user.id,
      title,
      target,
      result 
    });

    res.json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/generate-license
router.post('/generate-license', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const privateKey = process.env.LICENSE_PRIVATE_KEY;
    if (!privateKey) {
      throw createError('La llave privada de licencias no está configurada', 500);
    }

    const licenseData = req.body;
    
    if (!licenseData.id || !licenseData.userId || !licenseData.expiresAt) {
      throw createError('Faltan campos obligatorios en los datos de la licencia', 400);
    }

    // Firmar con ECDSA P-256 (SHA-256)
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(licenseData));
    sign.end();
    
    const signature = sign.sign(privateKey, 'base64');

    logger.info('Licencia generada', { 
      adminId: req.user?.id,
      licenseId: licenseData.id,
      userId: licenseData.userId
    });

    res.json({
      data: licenseData,
      signature
    });
  } catch (error) {
    next(error);
  }
});

export default router;
