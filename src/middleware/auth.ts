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
    id: string; // Opcional o usar el mismo NIT
    nit: string;
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
    // 1. Extraer el NIT (businessId o nit) del body o los headers
    const nit = req.body.businessId || req.body.nit || req.headers['x-business-id'] || req.query.businessId;

    if (!nit) {
      throw createError('Se requiere el NIT del emisor (businessId o nit) para procesar la solicitud', 401);
    }

    // 2. Buscar información del usuario
    // Si 'nit' tiene formato de UUID, buscamos directo. Si no, asumimos que es el NIT literal.
    // Para simplificar y evitar errores de Postgres (UUID syntax), buscamos primero el negocio por NIT
    let businessIdToSearch = nit;
    
    // Validar si parece un UUID (36 caracteres con guiones)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nit as string);
    
    if (!isUuid) {
      // Es un NIT, busquemos el id del negocio primero
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('nit', nit)
        .single();
        
      if (businessData) {
        businessIdToSearch = businessData.id;
      }
    }

    let userData = null;
    let userError = null;

    // Solo buscamos en business_users si tenemos un UUID válido para evitar error 22P02 de Postgres
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessIdToSearch as string)) {
      const result = await supabase
        .from('business_users')
        .select('id, role')
        .eq('business_id', businessIdToSearch)
        .limit(1)
        .maybeSingle();
      userData = result.data;
      userError = result.error;
    }

    if (userError && userError.code !== 'PGRST116') {
      logger.error('Error detallado de Supabase al verificar usuario:', { userError });
      // No lanzamos 500 aquí para no bloquear si falla esta consulta secundaria, 
      // dejamos que haga fallback a operator.
    }

    // 3. Establecer el usuario en el request
    req.user = {
      id: userData?.id || nit as string, // Usar ID de business_users o NIT como fallback
      nit: nit as string,
      role: userData?.role || 'operator' // Default a operator si no se encuentra
    };

    logger.debug('Solicitud autenticada', { nit: req.user.nit, role: req.user.role });
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
