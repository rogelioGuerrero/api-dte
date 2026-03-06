import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { createLogger } from '../utils/logger';
import { supabase } from '../database/supabase';

const logger = createLogger('auth');

export interface AuthRequest extends Omit<Request, 'headers' | 'params' | 'query' | 'body'> {
  headers: Request['headers'];
  params: Request['params'];
  query: Request['query'];
  body: Request['body'];
  user?: {
    id: string;
    email?: string;
    role?: 'owner' | 'admin' | 'operator';
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : null;

    if (!token) {
      throw createError('Token de autorización requerido', 401);
    }

    const { data: userResponse, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResponse?.user) {
      throw createError('Token inválido o usuario no encontrado', 401);
    }

    const supaUser = userResponse.user;
    req.user = {
      id: supaUser.id,
      email: supaUser.email || undefined,
      role: 'operator', // se ajusta abajo si hay businessId
    };

    // BusinessId opcional: body, query, params, header
    const businessIdRaw =
      (req.body && (req.body.businessId || req.body.business_id || req.body.nit)) ||
      (req.query && (req.query.businessId as string)) ||
      (req.params && (req.params.businessId || (req.params as any).id)) ||
      (req.headers['x-business-id'] as string);

    if (!businessIdRaw) {
      // Endpoint sin contexto de negocio (e.g., crear emisor o invitar)
      return next();
    }

    // Si no es UUID, intentar resolver por NIT
    let businessIdToSearch = businessIdRaw as string;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessIdToSearch);

    if (!isUuid) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('nit', businessIdToSearch)
        .single();

      if (businessData?.id) {
        businessIdToSearch = businessData.id;
      }
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessIdToSearch)) {
      throw createError('businessId inválido', 400);
    }

    const { data: membership, error: membershipError } = await supabase
      .from('business_users')
      .select('role')
      .eq('business_id', businessIdToSearch)
      .eq('user_id', supaUser.id)
      .single();

    if (membershipError) {
      if (membershipError.code === 'PGRST116') {
        throw createError('No autorizado para este emisor', 403);
      }
      throw membershipError;
    }

    req.user.role = (membership as any)?.role || 'operator';
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
