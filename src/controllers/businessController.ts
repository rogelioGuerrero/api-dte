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
  getBusinessSettingsById,
  getBusinessesByUserAsNit,
  createBusinessUser,
  getBusinessUsers,
  getUserRoleInBusiness,
  upsertBusinessSettings,
} from '../business/businessStorage';
import { supabase } from '../database/supabase';
import {
  PushSubscription,
  isPushConfigured,
  removePushSubscriptionForBusiness,
  savePushSubscriptionForBusiness,
  sendPushTestToBusiness,
} from '../services/pushService';

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

const resolveBusinessUuidToNit = async (businessUuid: string): Promise<string> => {
  const raw = (businessUuid || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  if (!isUuid) return raw;

  const { data, error } = await supabase
    .from('businesses')
    .select('nit, nit_clean')
    .eq('id', raw)
    .single();

  if (error || !data) return raw;
  return (data as any).nit_clean || (data as any).nit || raw;
};

const requireBusinessMembership = async (businessId: string, userId: string): Promise<void> => {
  const { data: membership, error: membershipError } = await supabase
    .from('business_users')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .single();

  if (membershipError || !membership?.id) {
    throw createError('No autorizado para este emisor', 403);
  }
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
    res.json({
      success: true,
      business: {
        id: business.id || null,
        nit: business.nit ?? null,
        nrc: business.nrc ?? null,
        nombre: business.nombre ?? null,
        nombre_comercial: business.nombre_comercial ?? null,
        telefono: business.telefono ?? null,
        correo: business.correo ?? null,
        dir_departamento: business.dir_departamento ?? null,
        dir_municipio: business.dir_municipio ?? null,
        dir_complemento: business.dir_complemento ?? null,
        cod_actividad: business.cod_actividad ?? null,
        desc_actividad: business.desc_actividad ?? null,
        tipo_establecimiento: business.tipo_establecimiento ?? null,
        cod_estable_mh: business.cod_estable_mh ?? null,
        cod_punto_venta_mh: business.cod_punto_venta_mh ?? null,
        logo_url: business.logo_url ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/settings/:businessId - configuración remota por emisor
router.get('/settings/:businessId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const businessId = req.params.businessId;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    const settings = await getBusinessSettingsById(businessId);
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
});

// PUT /api/business/settings/:businessId - crear o actualizar configuración remota por emisor
router.put('/settings/:businessId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const businessId = req.params.businessId;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    const {
      default_tab = null,
      features = {},
      push_enabled = false,
      fingerprint_enabled = false,
      advanced_config_enabled = false,
      plan_code = null,
      plan_label = null,
    } = req.body || {};

    const settings = await upsertBusinessSettings({
      business_id: businessId,
      default_tab,
      features,
      push_enabled,
      fingerprint_enabled,
      advanced_config_enabled,
      plan_code,
      plan_label,
    });

    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
});

// GET /api/businesses/:id/users - equipo del emisor
router.get('/businesses/:id/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const businessId = req.params.id;
    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);
    const users = await getBusinessUsers(businessId);
    res.json({
      success: true,
      users: users.map((user) => ({
        email: user.email,
        role: user.role,
      })),
    });
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
    const businessNit = await resolveBusinessUuidToNit(bu.business_id);
    res.json({ business_id: businessNit, role: bu.role });
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
    const businessNit = await resolveBusinessUuidToNit(bu.business_id);
    res.json({ business_id: businessNit, role: bu.role });
  } catch (error) {
    next(error);
  }
});

router.post('/business_users/lookup_email', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const { business_id, businessId, email } = req.body;
    const resolvedBusinessId = (businessId || business_id || '').toString();
    if (!resolvedBusinessId) throw createError('business_id es requerido', 400);
    if (!email) throw createError('email es requerido', 400);

    const role = req.user.role || 'operator';
    if (role !== 'owner' && role !== 'admin') {
      throw createError('No autorizado', 403);
    }

    const resolvedBusinessUuid = await resolveBusinessIdToUuid(resolvedBusinessId);

    const normalizedEmail = (email || '').toString().trim().toLowerCase();

    let foundUserId: string | null = null;
    let page = 1;
    const perPage = 200;

    while (!foundUserId) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw listError;

      const users = listData?.users || [];
      const match = users.find((u: any) => (u.email || '').toString().toLowerCase() === normalizedEmail);
      if (match?.id) {
        foundUserId = match.id;
        break;
      }

      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    if (!foundUserId) {
      return res.json({ exists: false, is_member: false, businesses_count: 0 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('business_users')
      .select('role')
      .eq('business_id', resolvedBusinessUuid)
      .eq('user_id', foundUserId)
      .maybeSingle();

    if (membershipError) throw membershipError;

    const { count: businessesCount, error: countError } = await supabase
      .from('business_users')
      .select('business_id', { count: 'exact', head: true })
      .eq('user_id', foundUserId);

    if (countError) throw countError;

    res.json({
      exists: true,
      is_member: !!membership,
      role: (membership as any)?.role || null,
      businesses_count: businessesCount || 0,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business_users/invite - envía invitación Supabase y responde pending
router.post('/business_users/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);
    const { businessId, email, role = 'operator' } = req.body;
    if (!businessId || !email) throw createError('businessId y email son requeridos', 400);
    if (!['owner', 'admin', 'operator'].includes(role)) {
      throw createError('role inválido', 400);
    }

    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    const requesterRole = await getUserRoleInBusiness(businessId, req.user.id);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      throw createError('No autorizado', 403);
    }

    const redirectTo =
      process.env.SUPABASE_INVITE_REDIRECT ||
      process.env.FRONTEND_URL ||
      'https://dte-test-staging.netlify.app/';

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
    if (error) throw error;

    res.json({
      success: true,
      invite: {
        businessId,
        email: data.user?.email || email,
        role,
        status: 'pending',
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/push-subscriptions - guarda suscripción push por negocio/dispositivo
router.post('/push-subscriptions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const { businessId, subscription, userAgent } = req.body as {
      businessId?: string | null;
      subscription?: PushSubscription;
      userAgent?: string;
    };

    if (!businessId) throw createError('businessId es requerido', 400);
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw createError('Suscripción inválida', 400);
    }

    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    await requireBusinessMembership(businessId, req.user.id);
    const saved = await savePushSubscriptionForBusiness(businessId, subscription, userAgent);

    res.status(201).json({
      success: true,
      pushSubscription: {
        businessId,
        endpoint: saved.endpoint,
        disabled: saved.disabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/business/push-subscriptions - elimina suscripción push por negocio/dispositivo
router.delete('/push-subscriptions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const { businessId, endpoint } = req.body as {
      businessId?: string | null;
      endpoint?: string;
    };

    if (!businessId) throw createError('businessId es requerido', 400);
    if (!endpoint) throw createError('endpoint es requerido', 400);

    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    await requireBusinessMembership(businessId, req.user.id);
    const removedCount = await removePushSubscriptionForBusiness(businessId, endpoint);

    res.json({
      success: true,
      removed: removedCount > 0,
      removedCount,
      businessId,
      endpoint,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/push-test - dispara una notificación de prueba a suscripciones activas
router.post('/push-test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) throw createError('No autenticado', 401);

    const {
      businessId,
      title = 'Prueba push',
      body = 'Notificación enviada correctamente',
      url = '/',
    } = req.body as {
      businessId?: string | null;
      title?: string;
      body?: string;
      url?: string;
    };

    if (!businessId) throw createError('businessId es requerido', 400);

    const business = await getBusinessById(businessId);
    if (!business) throw createError('Business no encontrado', 404);

    await requireBusinessMembership(businessId, req.user.id);

    const settings = await getBusinessSettingsById(businessId);
    if (!settings.push_enabled) {
      throw createError('Este negocio tiene deshabilitadas las notificaciones push desde Configuración Avanzada.', 409);
    }

    if (!isPushConfigured()) {
      throw createError('Backend push no configurado: faltan VAPID keys o subject válido', 500);
    }

    const result = await sendPushTestToBusiness(businessId, { title, body, url });

    res.json({
      success: true,
      result,
    });
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
