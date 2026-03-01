import { Router, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { saveMHCredentials, getBusinessByNIT, updateBusinessProfileById } from '../business/businessStorage';

const router = Router();
const logger = createLogger('businessController');

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
      correo
    } = req.body;

    // Usamos el NIT validado por el middleware (o el enviado en el body)
    const targetNit = nit || req.user?.nit;

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
      correo
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

export default router;
