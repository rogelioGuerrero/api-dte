import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';
import { createLogger } from '../utils/logger';

const logger = createLogger('auth');

export interface AuthRequest extends Omit<Request, 'headers' | 'params' | 'query' | 'body'> {
  headers: Request['headers'];
  params: Request['params'];
  query: Request['query'];
  body: Request['body'];
  user?: {
    id: string;
    nit: string;
    email: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createError('Authorization header required', 401);
    }

    const [bearer, token] = authHeader.split(' ');
    
    if (bearer !== 'Bearer' || !token) {
      throw createError('Invalid authorization format', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    req.user = {
      id: decoded.id,
      nit: decoded.nit,
      email: decoded.email
    };

    logger.debug('User authenticated', { userId: req.user.id });
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401));
    } else {
      next(error);
    }
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
