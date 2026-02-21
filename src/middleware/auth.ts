import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { createLogger } from '../utils/logger';

const logger = createLogger('auth');

export interface AuthRequest extends Omit<Request, 'headers' | 'params' | 'query' | 'body'> {
  headers: Request['headers'];
  params: Request['params'];
  query: Request['query'];
  body: Request['body'];
  user?: {
    id: string; // Opcional o usar el mismo NIT
    nit: string;
    email?: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Extraer el NIT (businessId o nit) del body o los headers
    const nit = req.body.businessId || req.body.nit || req.headers['x-business-id'] || req.query.businessId;

    if (!nit) {
      throw createError('Se requiere el NIT del emisor (businessId o nit) para procesar la solicitud', 401);
    }

    // 2. Establecer el usuario en el request basado en el NIT
    req.user = {
      id: nit as string, // Usamos el NIT como ID
      nit: nit as string
    };

    logger.debug('Solicitud autenticada por NIT', { nit: req.user.nit });
    next();
  } catch (error) {
    next(error);
  }
};

export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw createError('API key required', 401);
    }

    if (apiKey !== process.env.API_KEY_SECRET) {
      throw createError('Invalid API key', 401);
    }

    logger.debug('API key authenticated');
    next();
  } catch (error) {
    next(error);
  }
};
