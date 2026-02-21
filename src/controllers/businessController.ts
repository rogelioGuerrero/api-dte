import { Router, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { saveMHCredentials } from '../business/businessStorage';

const router = Router();
const logger = createLogger('businessController');

// POST /api/business/credentials
// Guarda o actualiza la contraseña del certificado y configuración en Supabase
router.post('/credentials', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nit, nrc, ambiente = '00', passwordPri, certificadoB64, apiToken, activo = true } = req.body;

    // Usamos el NIT validado por el middleware (o el enviado en el body)
    const targetNit = nit || req.user?.nit;

    if (!targetNit) {
      throw createError('El NIT es requerido para guardar credenciales', 400);
    }

    const nitLimpio = targetNit.replace(/[\s-]/g, '').trim();

    logger.info('Guardando credenciales MH', { nit: nitLimpio, ambiente, hasCert: !!certificadoB64 });

    const saved = await saveMHCredentials({
      business_id: nitLimpio, // Mantenemos relación (usando NIT como ID si no hay UUID)
      nit: nitLimpio,
      nrc: nrc || '',
      ambiente,
      password_pri: passwordPri,
      certificado_b64: certificadoB64,
      api_token: apiToken,
      activo
    });

    res.json({
      success: true,
      message: 'Credenciales y configuración guardadas correctamente',
      data: {
        nit: saved.nit,
        ambiente: saved.ambiente,
        activo: saved.activo,
        hasPassword: !!saved.password_pri,
        hasCert: !!saved.certificado_b64
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
