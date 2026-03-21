import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { createLogger } from '../utils/logger';
import { supabase } from '../database/supabase';
import { verifyDevAuthToken } from '../auth/devAuth';

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
    isPlatformAdmin?: boolean;
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

    const allowDevTokens = (process.env.AUTH_ALLOW_DEV_TOKENS ?? 'true').toLowerCase() !== 'false';

    if (allowDevTokens) {
      const devClaims = verifyDevAuthToken(token);
      if (devClaims) {
        req.user = {
          id: devClaims.sub || devClaims.email,
          email: devClaims.email,
          role: devClaims.role,
          isPlatformAdmin: devClaims.isPlatformAdmin,
        };

        const businessIdRaw =
          (req.body && (req.body.businessId || req.body.business_id || req.body.nit)) ||
          (req.query && (req.query.businessId as string)) ||
          (req.params && (req.params.businessId || (req.params as any).id)) ||
          (req.headers['x-business-id'] as string);

        if (businessIdRaw) {
          req.user.role = devClaims.isPlatformAdmin ? 'admin' : devClaims.role;
        }

        logger.info('Autenticación dev aceptada para Swagger', {
          email: devClaims.email,
          isPlatformAdmin: devClaims.isPlatformAdmin,
          businessId: devClaims.businessId,
        });

        return next();
      }
    }

    const { data: userResponse, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResponse?.user) {
      throw createError('Token inválido o usuario no encontrado', 401);
    }

    const supaUser = userResponse.user;
    const normalizedEmail = (supaUser.email || '').toLowerCase();

    const { data: platformAdmin, error: platformAdminError } = await supabase
      .from('platform_admins')
      .select('user_id, active')
      .eq('user_id', supaUser.id)
      .eq('email', normalizedEmail)
      .eq('active', true)
      .maybeSingle();

    if (platformAdminError) {
      throw platformAdminError;
    }

    const isPlatformAdmin = !!platformAdmin?.user_id;

    req.user = {
      id: supaUser.id,
      email: supaUser.email || undefined,
      role: 'operator', // se ajusta abajo si hay businessId
      isPlatformAdmin,
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

    if (isPlatformAdmin) {
      req.user.role = 'admin';
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
