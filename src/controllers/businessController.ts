import { Router, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import {
  saveMHCredentials,
  getBusinessByNIT,
  updateBusinessProfileById,
  createBusiness,
  getBusinessById,
  getBusinessesByUserAsNit,
  createBusinessUser,
  getBusinessUsers,
} from '../business/businessStorage';
import { supabase } from '../database/supabase';

const router = Router();
const logger = createLogger('businessController');

const resolveBusinessIdToUuid = async (businessIdOrNit: string): Promise<string> => {
  const raw = (businessIdOrNit || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  if (isUuid) return raw;

  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .or(`nit.eq.${raw},nit_clean.eq.${raw.replace(/[^0-9]/g, '')}`)
    .single();

  if (error || !data?.id) throw createError('Business no encontrado', 404);
  return data.id;
};

// POST /api/business/credentials
// Guarda o actualiza la contraseña del certificado y configuración en Supabase
router.post('/credentials', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      nit,
      nrc,
      ambiente = '00',
      passwordPri,
      certificadoB64,
      apiToken,
      apiPassword,
      activo = true,
      nombre,
      nombreComercial,
      codActividad,
      descActividad,
      tipoEstablecimiento,
      codEstable,
      codPuntoVenta,
      codEstableMH,
      codPuntoVentaMH,
      direccion,
      telefono,
      correo,
      logoUrl
    } = req.body;

    const targetNit = nit;

    if (!targetNit) {
      throw createError('El NIT es requerido para guardar credenciales', 400);
    }

    const nitLimpio = targetNit.replace(/[^0-9]/g, '').trim();

    // Validar NIT: 9 o 14 dígitos sin guiones
    if (!/^\d{9}$/.test(nitLimpio) && !/^\d{14}$/.test(nitLimpio)) {
      throw createError('NIT inválido: debe tener 9 o 14 dígitos sin guiones', 400);
    }

    // Obtener el business_id real desde la tabla businesses
    const business = await getBusinessByNIT(nitLimpio);
    if (!business) {
      throw createError('Business no encontrado para el NIT proporcionado', 404);
    }

    // Actualizar perfil del negocio con los campos opcionales enviados
    const direccionPayload = direccion || {};
    await updateBusinessProfileById(business.id!, {
      nit: targetNit,
      nit_clean: nitLimpio,
      nrc,
      nombre,
      nombre_comercial: nombreComercial || business.nombre_comercial,
      cod_actividad: codActividad,
      desc_actividad: descActividad,
      tipo_establecimiento: tipoEstablecimiento,
      cod_estable: codEstable,
      cod_punto_venta: codPuntoVenta,
      cod_estable_mh: codEstableMH,
      cod_punto_venta_mh: codPuntoVentaMH,
      dir_departamento: direccionPayload.departamento,
      dir_municipio: direccionPayload.municipio,
      dir_complemento: direccionPayload.complemento,
      telefono,
      correo,
      logo_url: logoUrl ?? business.logo_url
    });

    logger.info('Guardando credenciales MH', { 
      nit: nitLimpio, 
      ambiente, 
      hasCert: !!certificadoB64,
      hasApiPassword: !!apiPassword,
      certLength: certificadoB64 ? certificadoB64.length : 0,
      certStart: certificadoB64 ? certificadoB64.substring(0, 50) : null
    });

    const saved = await saveMHCredentials({
      business_id: business.id, // Usar el UUID real del business
      nit: nitLimpio,
      nrc: nrc || '',
      ambiente,
      password_pri: passwordPri,
      certificado_b64: certificadoB64,
      api_token: apiToken,
      api_password: apiPassword,
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
        hasCert: !!saved.certificado_b64,
        profile: {
          nrc: nrc || business.nrc,
          nombre: nombre || business.nombre,
          nombreComercial: nombreComercial || business.nombre_comercial,
          codActividad: codActividad || business.cod_actividad,
          descActividad: descActividad || business.desc_actividad,
          tipoEstablecimiento: tipoEstablecimiento || business.tipo_establecimiento,
          codEstable: codEstable ?? business.cod_estable,
          codPuntoVenta: codPuntoVenta ?? business.cod_punto_venta,
          codEstableMH: codEstableMH ?? business.cod_estable_mh,
          codPuntoVentaMH: codPuntoVentaMH ?? business.cod_punto_venta_mh,
          direccion: {
            departamento: direccionPayload.departamento ?? business.dir_departamento,
            municipio: direccionPayload.municipio ?? business.dir_municipio,
            complemento: direccionPayload.complemento ?? business.dir_complemento
          },
          telefono: telefono ?? business.telefono,
          correo: correo ?? business.correo
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/businesses - crear emisor y asociar como owner
router.post('/businesses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const {
      nit,
      business_id,
      nrc,
      nombre,
      nombre_comercial,
      correo,
      telefono,
      dir_departamento,
      dir_municipio,
      dir_complemento,
      cod_actividad,
      desc_actividad,
      logo_url,
    } = req.body;

    const resolvedNit = (nit || business_id || '').toString();
    const resolvedNombre = (nombre || nombre_comercial || '').toString();

    if (!resolvedNit || !resolvedNombre) {
      throw createError('business_id (nit) y nombre son requeridos', 400);
    }

    const business = await createBusiness({
      nit: resolvedNit,
      nrc,
      nombre: resolvedNombre,
      nombre_comercial: resolvedNombre,
      correo,
      telefono,
      dir_departamento,
      dir_municipio,
      dir_complemento,
      cod_actividad,
      desc_actividad,
      logo_url,
      owner_email: req.user.email,
    });

    await createBusinessUser({ business_id: business.id!, user_id: req.user.id, role: 'owner' });

    res.json({ business_id: business.nit_clean || business.nit, role: 'owner' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/businesses/:id - actualizar emisor
router.put('/businesses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const businessId = req.params.id;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    const updated = await updateBusinessProfileById(businessId, req.body || {});
    res.json({ success: true, business: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/businesses/me - lista emisores del usuario
router.get('/businesses/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const businesses = await getBusinessesByUserAsNit(req.user.id);
    res.json(businesses);
  } catch (error) {
    next(error);
  }
});

// GET /api/businesses/:id - datos del negocio (requiere membership via authMiddleware)
router.get('/businesses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const businessId = req.params.id;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);
    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
});

// GET /api/businesses/:id/users - equipo del emisor
router.get('/businesses/:id/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const businessId = req.params.id;
    const users = await getBusinessUsers(businessId);
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users - asociar user a emisor
router.post('/business_users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId, userId, role } = req.body;
    if (!businessId || !userId || !role) throw createError('businessId, userId y role son requeridos', 400);
    const bu = await createBusinessUser({ business_id: businessId, user_id: userId, role });
    res.json({ success: true, businessUser: bu });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users/claim - alias de confirm/join
router.post('/business_users/claim', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const { business_id, businessId, role = 'operator' } = req.body;
    const resolvedBusinessId = (businessId || business_id || '').toString();
    if (!resolvedBusinessId) throw createError('business_id es requerido', 400);

    const resolvedBusinessUuid = await resolveBusinessIdToUuid(resolvedBusinessId);
    const bu = await createBusinessUser({ business_id: resolvedBusinessUuid, user_id: req.user.id, role });
    res.json({ success: true, businessUser: bu });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users/join - alias de confirm/claim
router.post('/business_users/join', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const { business_id, businessId, role = 'operator' } = req.body;
    const resolvedBusinessId = (businessId || business_id || '').toString();
    if (!resolvedBusinessId) throw createError('business_id es requerido', 400);

    const resolvedBusinessUuid = await resolveBusinessIdToUuid(resolvedBusinessId);
    const bu = await createBusinessUser({ business_id: resolvedBusinessUuid, user_id: req.user.id, role });
    res.json({ success: true, businessUser: bu });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users/invite - envía invitación Supabase y responde pending
router.post('/business_users/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessId, email, role = 'operator' } = req.body;
    if (!businessId || !email) throw createError('businessId y email son requeridos', 400);

    const redirectTo =
      process.env.SUPABASE_INVITE_REDIRECT ||
      process.env.FRONTEND_URL ||
      'https://dte-test-staging.netlify.app/';

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
    if (error) throw error;

    res.json({ success: true, invite: { email: data.user?.email, role, status: 'pending' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users/confirm - asocia al usuario autenticado al emisor
router.post('/business_users/confirm', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const { businessId, role = 'operator' } = req.body;
    if (!businessId) throw createError('businessId es requerido', 400);

    const resolvedBusinessUuid = await resolveBusinessIdToUuid(businessId);
    const bu = await createBusinessUser({ business_id: resolvedBusinessUuid, user_id: req.user.id, role });
    res.json({ success: true, businessUser: bu });
  } catch (error) {
    next(error);
  }
});

// PUT /api/mh_credentials/:businessId - guardar credenciales MH
router.put('/mh_credentials/:businessId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.params.businessId;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    const {
      ambiente = '00',
      certificado_b64,
      certificate_b64,
      certificadoB64,
      password_pri,
      passwordPri,
      api_password,
      apiPassword,
      api_token,
      apiToken,
      cod_estable,
      cod_punto_venta,
      cod_estable_mh,
      cod_punto_venta_mh,
      codEstable,
      codPuntoVenta,
      codEstableMH,
      codPuntoVentaMH,
      activo = true,
    } = req.body;

    const saved = await saveMHCredentials({
      business_id: business.id!,
      nit: business.nit,
      nrc: business.nrc || '',
      ambiente,
      certificado_b64: certificado_b64 || certificate_b64 || certificadoB64,
      password_pri: password_pri || passwordPri,
      api_password: api_password || apiPassword,
      api_token: api_token || apiToken,
      activo,
    });

    res.json({
      success: true,
      mhCredentials: {
        nit: saved.nit,
        ambiente: saved.ambiente,
        activo: saved.activo,
        hasPassword: !!saved.password_pri,
        hasCert: !!saved.certificado_b64,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
