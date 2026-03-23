import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { dteGraph } from '../workflows/dteWorkflow';
import { INITIAL_STATE, DTEState } from '../workflows/state';
import { processDTE } from '../mh/process';
import { AuthRequest } from '../middleware/auth';
import { createProcessResponse, DteProcessResponse } from '../utils/apiResponse';
import { getDTEResponseByCodigo, getDTEResponseByNumeroControl, getDTEResponses } from '../business/dteStorage';
import { getBusinessById, getBusinessByNIT, resolveBusinessIdentityByNIT } from '../business/businessStorage';

const router = Router();
const logger = createLogger('dteController');
const activeEmissionRequests = new Map<string, number>();

const buildEmissionLockKey = (businessId: string, codigoGeneracion: string) =>
  `${businessId}:${codigoGeneracion.trim().toUpperCase()}`;

const isDuplicateNumeroControlMhResponse = (mhResponse: any) => {
  if (!mhResponse) return false;
  const message = `${mhResponse.mensaje || ''} ${mhResponse.descripcionMsg || ''}`.toUpperCase();
  return mhResponse.codigoMsg === '004' || message.includes('YA EXISTE UN REGISTRO CON ESE VALOR');
};

const buildReconciledMhResponse = (payload: {
  existingMhResponse?: any;
  codigoGeneracion?: string;
  numeroControl?: string;
  duplicateMhResponse?: any;
  source: 'mh_consulta' | 'local_storage';
}) => {
  const mh = payload.existingMhResponse || {};
  return {
    success: true,
    estado: mh.estado || 'PROCESADO',
    codigoGeneracion: mh.codigoGeneracion || payload.codigoGeneracion,
    numeroControl: mh.numeroControl || payload.numeroControl,
    selloRecepcion: mh.selloRecepcion || mh.selloRecibido,
    fechaHoraRecepcion: mh.fechaHoraRecepcion,
    fechaHoraProcesamiento: mh.fechaHoraProcesamiento || mh.fhProcesamiento,
    mensaje: mh.mensaje || 'Documento ya procesado previamente en MH y reconciliado exitosamente.',
    enlaceConsulta: mh.enlaceConsulta,
    advertencias: mh.advertencias,
    errores: mh.errores,
    reconciled: true,
    reconciliationSource: payload.source,
    originalDuplicateResponse: payload.duplicateMhResponse,
  };
};

// Request interface para /api/dte/process
const isTemporarySignerWait = (result: any) =>
  result?.currentStep === 'signer' && result?.errorCode === 'SIGNER_TEMPORARILY_UNAVAILABLE';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const resolveBusinessIdForHistory = async (businessIdOrNit: string): Promise<{ businessId: string; nit?: string }> => {
  const rawValue = (businessIdOrNit || '').trim();

  if (!rawValue) {
    return { businessId: rawValue };
  }

  if (isUuid(rawValue)) {
    return { businessId: rawValue };
  }

  const business = await getBusinessByNIT(rawValue);
  if (business?.id) {
    return {
      businessId: business.id,
      nit: (business.nit_clean || business.nit || rawValue).replace(/[^0-9]/g, ''),
    };
  }

  return { businessId: rawValue.replace(/[^0-9a-f-]/gi, '') };
};

const getPersistedDteJson = (doc: any) => doc?.dte_json || doc?.mh_response?.dteJson || doc?.mh_response?.dte_json || null;

const getPersistedTotals = (doc: any) => getPersistedDteJson(doc)?.resumen || {};

const getPersistedReceptor = (doc: any) => getPersistedDteJson(doc)?.receptor || {};

const toHistoricalRecord = (doc: any) => ({
  codigoGeneracion: doc.codigo_generacion,
  tipoDte: doc.tipo_dte,
  numeroControl: getPersistedDteJson(doc)?.identificacion?.numeroControl || '',
  estado: doc.estado || doc.mh_response?.estado || 'procesado',
  claseDocumento: 'emitido',
  createdAt: doc.created_at,
  updatedAt: doc.fecha_hora_procesamiento || doc.created_at,
  montoTotal: getPersistedTotals(doc)?.montoTotalOperacion || 0,
  receptorNombre: getPersistedReceptor(doc)?.nombre || '',
  receptorNit: getPersistedReceptor(doc)?.nit || '',
  selloRecibido: doc.sello_recibido || doc.mh_response?.selloRecepcion || doc.mh_response?.selloRecibido,
  fhProcesamiento: doc.fecha_hora_procesamiento || doc.mh_response?.fechaHoraProcesamiento || null,
  tienePdf: !!doc.pdf_url,
  tieneXml: !!doc.xml_url,
  tieneJson: !!doc.json_url,
});

const buildPendingSignerResponse = (result: any, dte: any) => ({
  success: true,
  estado: 'PENDIENTE_FIRMA',
  codigoGeneracion:
    result?.codigoGeneracion ||
    result?.dte?.identificacion?.codigoGeneracion ||
    dte?.identificacion?.codigoGeneracion,
  numeroControl:
    result?.dte?.identificacion?.numeroControl ||
    dte?.identificacion?.numeroControl,
  mensaje: 'Estamos preparando tu documento. Contin?a en proceso y puedes reintentar en unos segundos si a?n no finaliza.',
  pending: true,
});

interface ProcessDTERequest {
  dte: any;
  passwordPri?: string;
  ambiente: '00' | '01';
  flowType: 'emission' | 'reception';
  businessId?: string;
  nit?: string;
  deviceId?: string;
  receptorEmail?: string;
}

// POST /api/dte/validate
router.post('/validate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dte } = req.body;
    
    if (!dte) {
      throw createError('DTE is required', 400);
    }
    
    logger.info('Validating DTE', { tipoDTE: dte.identificacion?.tipoDte });
    
    const processed = processDTE(dte);
    
    res.json({
      valid: processed.errores.length === 0,
      errors: processed.errores,
      dte: processed.dte
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dte/sign
router.post('/sign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dte, passwordPri } = req.body;
    
    if (!dte || !passwordPri) {
      throw createError('DTE and passwordPri are required', 400);
    }
    
    logger.info('Signing DTE');
    
    // Ejecutar solo los nodos de validaciÃ³n y firma
    const result = await (dteGraph as any).invoke({
      ...INITIAL_STATE,
      dte,
      inputDte: dte,
      passwordPri,
      flowType: 'emission'
    });
    
    if (!result.isSigned) {
      throw createError('Failed to sign DTE', 500);
    }
    
    res.json({
      signed: true,
      signature: result.signature,
      dte: result.dte
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dte/transmit
router.post('/transmit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dte, passwordPri, ambiente = '00' } = req.body;
    
    if (!dte) {
      throw createError('DTE is required', 400);
    }
    
    const nitEmisor = dte.emisor?.nit?.replace(/[^0-9]/g, '') || '';
    if (!nitEmisor) {
      throw createError('El DTE no incluye NIT del emisor', 400);
    }

    const identity = await resolveBusinessIdentityByNIT(nitEmisor);
    if (!identity) {
      throw createError(`No existe business asociado al NIT ${nitEmisor}`, 404);
    }
    
    logger.info('Transmitting DTE to MH');
    
    // Ejecutar workflow completo
    const result = await (dteGraph as any).invoke({
      ...INITIAL_STATE,
      dte,
      inputDte: dte,
      passwordPri,
      ambiente,
      flowType: 'emission',
      businessId: identity.businessId,
      nit: identity.nit,
    });

    logger.info('Raw transmit invoke result', {
      keys: result ? Object.keys(result) : [],
      status: result?.status,
      currentStep: result?.currentStep,
      isValid: result?.isValid,
      isSigned: result?.isSigned,
      isTransmitted: result?.isTransmitted,
      hasSignature: !!result?.signature,
      hasMhResponse: !!result?.mhResponse,
      errorCode: result?.errorCode,
      errorMessage: result?.errorMessage,
      validationErrors: result?.validationErrors,
    });

    const duplicateMhResponse = result?.mhResponse;
    const isDuplicateNumeroControl = isDuplicateNumeroControlMhResponse(duplicateMhResponse);
    const codigoGeneracion = dte?.identificacion?.codigoGeneracion;
    const numeroControl = dte?.identificacion?.numeroControl;
    const tipoDte = dte?.identificacion?.tipoDte;

    if (isDuplicateNumeroControl && codigoGeneracion && numeroControl) {
      const consultaMh = result?.mhDuplicateCheck;
      const consultaEstado = `${consultaMh?.estado || consultaMh?.status || ''}`.toUpperCase();
      const mhAlreadyProcessed = ['PROCESADO', 'ACEPTADO', 'ACEPTADO_CON_ADVERTENCIAS'].includes(consultaEstado);

      if (mhAlreadyProcessed) {
        const reconciledMhResponse = buildReconciledMhResponse({
          existingMhResponse: consultaMh,
          codigoGeneracion,
          numeroControl,
          duplicateMhResponse,
          source: 'mh_consulta',
        });

        logger.warn('DTE reconciliado desde consulta MH tras duplicado numeroControl', {
          codigoGeneracion,
          numeroControl,
          businessId: identity.businessId,
          estadoConsulta: consultaEstado,
        });

        return res.json({
          transmitted: true,
          mhResponse: reconciledMhResponse,
          signature: result.signature,
          isOffline: false,
          contingencyReason: undefined,
          status: 'completed',
          currentStep: result.currentStep,
          errorCode: undefined,
          errorMessage: undefined,
          validationErrors: result.validationErrors,
        });
      }

      const [existingResponse, existingDocument] = await Promise.all([
        getDTEResponseByCodigo(codigoGeneracion).catch(() => null),
        getDTEResponseByNumeroControl(identity.businessId, numeroControl, undefined, tipoDte).catch(() => null),
      ]);

      const existingMhResponse =
        existingResponse?.mh_response ||
        existingResponse?.mhResponse ||
        existingDocument?.mh_response;

      const existingProcessedState = `${existingMhResponse?.estado || existingDocument?.estado || ''}`.toUpperCase();
      const hasExistingProcessed =
        ['PROCESADO', 'ACEPTADO', 'ACEPTADO_CON_ADVERTENCIAS', 'TRANSMITTED', 'COMPLETED', 'PROCESSED'].includes(existingProcessedState);

      if (hasExistingProcessed && existingMhResponse) {
        const reconciledMhResponse = buildReconciledMhResponse({
          existingMhResponse,
          codigoGeneracion,
          numeroControl,
          duplicateMhResponse,
          source: 'local_storage',
        });

        logger.warn('DTE reconciliado desde persistencia local tras duplicado numeroControl', {
          codigoGeneracion,
          numeroControl,
          businessId: identity.businessId,
          existingProcessedState,
        });

        return res.json({
          transmitted: true,
          mhResponse: reconciledMhResponse,
          signature: result.signature,
          isOffline: false,
          contingencyReason: undefined,
          status: 'completed',
          currentStep: result.currentStep,
          errorCode: undefined,
          errorMessage: undefined,
          validationErrors: result.validationErrors,
        });
      }
    }

    const fallbackMhResponse = !result.mhResponse
      ? {
          success: false,
          estado: result.status === 'contingency' ? 'CONTINGENCIA' : 'RECHAZADO',
          codigoGeneracion:
            result.codigoGeneracion ||
            result.dte?.identificacion?.codigoGeneracion ||
            dte?.identificacion?.codigoGeneracion,
          numeroControl:
            result.dte?.identificacion?.numeroControl ||
            dte?.identificacion?.numeroControl,
          mensaje: result.errorMessage || 'El backend rechazÃ³ o no pudo completar la transmisiÃ³n.',
          errores: [
            {
              codigo: result.errorCode || 'BACKEND-WORKFLOW',
              descripcion: result.errorMessage || 'Fallo interno del workflow DTE',
              severidad: 'ERROR',
              ...(result.currentStep ? { campo: result.currentStep } : {}),
              ...(result.validationErrors?.length
                ? { valorActual: result.validationErrors.join(' | ') }
                : {}),
            },
          ],
        }
      : result.mhResponse;

    logger.info('Transmit workflow result', {
      status: isTemporarySignerWait(result) ? 'processing' : result.status,
      currentStep: result.currentStep,
      errorCode: isTemporarySignerWait(result) ? undefined : result.errorCode,
      hasMhResponse: !!result.mhResponse,
      isTransmitted: result.isTransmitted,
    });

    res.json({
      transmitted: isTemporarySignerWait(result) ? false : result.isTransmitted,
      mhResponse: fallbackMhResponse,
      signature: result.signature,
      isOffline: result.isOffline,
      contingencyReason: result.contingencyReason,
      status: isTemporarySignerWait(result) ? 'processing' : result.status,
      currentStep: result.currentStep,
      errorCode: isTemporarySignerWait(result) ? undefined : result.errorCode,
      errorMessage: isTemporarySignerWait(result) ? undefined : result.errorMessage,
      validationErrors: result.validationErrors,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dte/process
router.post('/process', async (req: AuthRequest, res: Response, next: NextFunction) => {
  let emissionLockKey: string | null = null;
  try {
    const request: ProcessDTERequest = req.body;
    
    // Validar campos requeridos
    if (!request.dte || (!request.businessId && !request.nit)) {
      throw createError('Faltan campos requeridos: dte, businessId o nit', 400);
    }

    const targetBusinessIdOrNit = request.businessId || request.nit;
    let identity: { businessId: string; nit: string } | null = null;

    if (request.businessId) {
      const business = await getBusinessById(request.businessId);
      if (business?.id && business.nit) {
        identity = {
          businessId: business.id,
          nit: business.nit,
        };
      }
    }

    if (!identity && request.nit) {
      identity = await resolveBusinessIdentityByNIT(request.nit);
    }

    if (!identity && targetBusinessIdOrNit) {
      identity = await resolveBusinessIdentityByNIT(targetBusinessIdOrNit);
    }

    if (!identity) {
      throw createError(`Business no encontrado para businessId/NIT ${targetBusinessIdOrNit}`, 404);
    }

    // Extraer cÃ³digo de generaciÃ³n del DTE
    const codigoGeneracion = request.dte.identificacion?.codigoGeneracion;
    if (!codigoGeneracion) {
      throw createError('El DTE no tiene cÃ³digo de generaciÃ³n', 400);
    }
    const numeroControl = request.dte.identificacion?.numeroControl;

    emissionLockKey = buildEmissionLockKey(identity.businessId, codigoGeneracion);
    if (activeEmissionRequests.has(emissionLockKey)) {
      logger.warn('Bloqueando reintento concurrente de DTE', {
        codigoGeneracion,
        numeroControl,
        businessId: identity.businessId,
        nit: identity.nit,
      });

      return res.status(409).json({
        success: false,
        error: {
          severity: 'warning',
          category: 'system',
          code: 'DTE_ALREADY_PROCESSING',
          userMessage: 'Tu documento ya estÃ¡ siendo enviado. Por favor espera unos segundos; no es necesario volver a enviarlo.',
          canRetry: false,
          details: [`codigoGeneracion: ${codigoGeneracion}`]
        }
      } satisfies DteProcessResponse);
    }

    activeEmissionRequests.set(emissionLockKey, Date.now());

    logger.info('Iniciando procesamiento DTE', { 
      codigoGeneracion, 
      numeroControl,
      businessId: identity.businessId,
      nit: identity.nit,
      flowType: request.flowType 
    });

    // Crear estado inicial para LangGraph
    const initialState: Partial<DTEState> = {
      dte: request.dte,
      inputDte: request.dte,
      passwordPri: request.passwordPri, // Puede ser null, lo sacarÃ¡ de Supabase
      ambiente: request.ambiente || '00',
      flowType: request.flowType || 'emission',
      businessId: identity.businessId,
      nit: identity.nit,
      receptorEmail: request.receptorEmail?.trim() || undefined,
      deviceId: request.deviceId,
      codigoGeneracion,
      status: 'validating',
      progressPercentage: 10,
      currentStep: 'start',
      estimatedTime: 60
    };

    // Ejecutar workflow de LangGraph
    const result = await (dteGraph as any).invoke(initialState);

    // Crear respuesta estandarizada para frontend
    const response: DteProcessResponse = createProcessResponse(result);

    logger.info('Procesamiento DTE completado', { 
      codigoGeneracion, 
      status: isTemporarySignerWait(result) ? 'processing' : result.status,
      success: response.success
    });

    res.json(response);

  } catch (error: any) {
    logger.error('Error en procesamiento DTE', { error: error.message });
    next(error);
  } finally {
    if (emissionLockKey) {
      activeEmissionRequests.delete(emissionLockKey);
    }
  }
});

// POST /api/dte/contingency
router.post('/contingency', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dte, passwordPri, motivo = 'Falla en el servicio de Internet' } = req.body;
    
    if (!dte || !passwordPri) {
      throw createError('DTE and passwordPri are required', 400);
    }
    
    logger.info('Processing DTE in contingency mode', { motivo });
    
    // Ejecutar workflow con modo contingencia
    const result = await (dteGraph as any).invoke({
      ...INITIAL_STATE,
      dte,
      passwordPri,
      ambiente: '00',
      flowType: 'emission',
      status: 'contingency',
      isOffline: true,
      contingencyReason: motivo
    });
    
    res.json({
      processed: result.status === 'completed',
      dte: result.dte,
      signature: result.signature,
      contingencyReason: result.contingencyReason
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dte/:codigoGeneracion/status
 * Consulta el estado actual de un DTE especÃ­fico
 */
router.get('/:codigoGeneracion/status', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { codigoGeneracion } = req.params;
      const businessId = req.headers['x-business-id'] as string;

      if (!businessId) {
        throw createError('Se requiere x-business-id header', 400);
      }

      const responseDte = await getDTEResponseByCodigo(codigoGeneracion);

      if (!responseDte) {
        throw createError('DTE no encontrado', 404);
      }

      // Verificar que pertenezca al negocio
      if (responseDte.business_id !== businessId) {
        throw createError('No autorizado para acceder a este DTE', 403);
      }

      const persistedDteJson = getPersistedDteJson(responseDte);

      const status = {
        codigoGeneracion,
        estado: responseDte.estado || responseDte.mh_response?.estado,
        tipoDte: responseDte.tipo_dte,
        claseDocumento: 'emitido',
        createdAt: responseDte.created_at,
        updatedAt: responseDte.fecha_hora_procesamiento || responseDte.created_at,
        
        // Respuesta de MH si estÃ¡ disponible
        mhResponse: responseDte.mh_response ? responseDte.mh_response : null,
        
        // URLs de documentos
        documentos: {
          pdf: responseDte.pdf_url,
          xml: responseDte.xml_url,
          json: responseDte.json_url
        },
        dte: persistedDteJson ? {
          identificacion: persistedDteJson.identificacion,
          receptor: persistedDteJson.receptor,
          resumen: persistedDteJson.resumen,
        } : null
      };

      res.json(status);

    } catch (error: any) {
      logger.error('Error consultando estado DTE', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/dte/business/:businessId/dtes
 * Lista DTEs de un negocio con filtros opcionales
 */
router.get('/business/:businessId/dtes', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { businessId: businessIdParam } = req.params;
      const { 
        estado, 
        tipo, 
        clase, 
        limit = '50', 
        offset = '0',
        search,
        fechaDesde,
        fechaHasta
      } = req.query;

      const resolvedBusiness = await resolveBusinessIdForHistory(businessIdParam);

      // Opciones de filtrado
      const options = {
        tipoDte: tipo as string,
        claseDocumento: clase as string,
        estado: estado as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        search: search as string,
        fechaDesde: fechaDesde as string,
        fechaHasta: fechaHasta as string
      };

      // Obtener DTEs del negocio
      const dtes = await getDTEResponses(resolvedBusiness.businessId, Math.max(options.limit, 1), options.offset);

      const filteredDtes = dtes.filter((doc: any) => {
        const dteJson = getPersistedDteJson(doc);
        const createdAt = doc.fecha_hora_procesamiento || doc.created_at;
        const searchValue = (options.search || '').trim().toLowerCase();

        if (options.tipoDte && doc.tipo_dte !== options.tipoDte) return false;
        if (options.estado && `${doc.estado || ''}`.toLowerCase() !== `${options.estado}`.toLowerCase()) return false;
        if (options.fechaDesde && createdAt && new Date(createdAt) < new Date(options.fechaDesde)) return false;
        if (options.fechaHasta && createdAt && new Date(createdAt) > new Date(`${options.fechaHasta}T23:59:59`)) return false;

        if (searchValue) {
          const receptorNombre = `${dteJson?.receptor?.nombre || ''}`.toLowerCase();
          const receptorNit = `${dteJson?.receptor?.nit || ''}`.toLowerCase();
          const numeroControl = `${dteJson?.identificacion?.numeroControl || ''}`.toLowerCase();
          return receptorNombre.includes(searchValue) || receptorNit.includes(searchValue) || numeroControl.includes(searchValue);
        }

        return true;
      });

      const response = {
        businessId: resolvedBusiness.businessId,
        dtes: filteredDtes.map(toHistoricalRecord),
        total: filteredDtes.length,
        resolvedFrom: isUuid(businessIdParam) ? 'uuid' : 'nit',
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: filteredDtes.length === options.limit
        }
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Error listando DTEs del negocio', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/dte/business/:businessId/resumen
 * Obtiene resumen de ventas por período
 */
router.get('/business/:businessId/resumen', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { businessId: businessIdParam } = req.params;
      const { 
        fechaDesde,
        fechaHasta,
        tipoDte
      } = req.query;

      const resolvedBusiness = await resolveBusinessIdForHistory(businessIdParam);

      if (!fechaDesde || !fechaHasta) {
        throw createError('Se requieren fechaDesde y fechaHasta', 400);
      }

      // Obtener DTEs del período
      const options = {
        tipoDte: tipoDte as string,
        fechaDesde: fechaDesde as string,
        fechaHasta: fechaHasta as string,
        limit: 10000 // Sin límite para resumen
      };

      const dtes = await getDTEResponses(resolvedBusiness.businessId, 10000, 0);

      // Calcular resumen
      const resumen = {
        totalVentas: 0,
        totalIva: 0,
        totalGravada: 0,
        totalExenta: 0,
        totalNoSuj: 0,
        cantidadDocumentos: dtes.length,
        detallePorTipo: {} as Record<string, { cantidad: number; total: number }>
      };

      dtes.forEach((doc: any) => {
        const totales = getPersistedTotals(doc);
        const montoTotal = parseFloat(totales.montoTotalOperacion || '0');
        const iva = parseFloat(totales.iva || '0');
        const gravada = parseFloat(totales.totalGravada || '0');
        const exenta = parseFloat(totales.totalExenta || '0');
        const noSuj = parseFloat(totales.totalNoSuj || '0');
        const tipo = doc.tipo_dte;

        // Acumular totales generales
        resumen.totalVentas += montoTotal;
        resumen.totalIva += iva;
        resumen.totalGravada += gravada;
        resumen.totalExenta += exenta;
        resumen.totalNoSuj += noSuj;

        // Acumular por tipo
        if (!resumen.detallePorTipo[tipo]) {
          resumen.detallePorTipo[tipo] = { cantidad: 0, total: 0 };
        }
        resumen.detallePorTipo[tipo].cantidad++;
        resumen.detallePorTipo[tipo].total += montoTotal;
      });

      const response = {
        businessId: resolvedBusiness.businessId,
        resolvedFrom: isUuid(businessIdParam) ? 'uuid' : 'nit',
        periodo: {
          fechaDesde: fechaDesde,
          fechaHasta: fechaHasta
        },
        resumen: {
          ...resumen,
          totalVentas: Math.round(resumen.totalVentas * 100) / 100,
          totalIva: Math.round(resumen.totalIva * 100) / 100,
          totalGravada: Math.round(resumen.totalGravada * 100) / 100,
          totalExenta: Math.round(resumen.totalExenta * 100) / 100,
          totalNoSuj: Math.round(resumen.totalNoSuj * 100) / 100
        }
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Error generando resumen de ventas', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /api/dte/:codigoGeneracion/retry
 * Reintenta la transmisiÃ³n de un DTE en contingencia
 */
router.post('/:codigoGeneracion/retry', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { codigoGeneracion } = req.params;
      const businessId = req.headers['x-business-id'] as string;
      const { ambiente = '00' } = req.body;

      if (!businessId) {
        throw createError('Se requiere x-business-id header', 400);
      }

      // Buscar DTE en contingencia
      const responseDte = await getDTEResponseByCodigo(codigoGeneracion);

      if (!responseDte) {
        throw createError('DTE no encontrado', 404);
      }

      if (responseDte.business_id !== businessId) {
        throw createError('No autorizado para acceder a este DTE', 403);
      }

      if ((responseDte.estado || '').toLowerCase() !== 'contingency') {
        throw createError('Solo se pueden reintentar DTEs en contingencia', 400);
      }

      logger.info('Reintentando transmisiÃ³n DTE', { codigoGeneracion, businessId });

      const result = {
        success: true,
        message: 'Reintentando transmisiÃ³n',
        codigoGeneracion,
        newStatus: 'transmitting',
        ambiente
      };

      res.json(result);

    } catch (error: any) {
      logger.error('Error reintentando DTE', { error: error.message });
      next(error);
    }
  }
);

export default router;



