import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { dteGraph } from '../workflows/dteWorkflow';
import { INITIAL_STATE, DTEState } from '../workflows/state';
import { processDTE } from '../mh/process';
import { AuthRequest } from '../middleware/auth';
import { getDTEDocument, updateDTEDocumentStatus } from '../dte/dteStorage';
import { getDTEsByBusiness } from '../dte/dteStorage';
import { createProcessResponse, DteProcessResponse } from '../utils/apiResponse';

const router = Router();
const logger = createLogger('dteController');

// Request interface para /api/dte/process
interface ProcessDTERequest {
  dte: any;                    // DTE JSON completo
  passwordPri?: string;        // Password para firma (ahora opcional, se busca en Supabase)
  ambiente: '00' | '01';       // Pruebas/Producción
  flowType: 'emission' | 'reception';
  businessId: string;          // UUID del negocio
  deviceId?: string;           // Fingerprint opcional
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
    
    // Ejecutar solo los nodos de validación y firma
    const result = await (dteGraph as any).invoke({
      ...INITIAL_STATE,
      dte,
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
    
    if (!dte || !passwordPri) {
      throw createError('DTE and passwordPri are required', 400);
    }
    
    logger.info('Transmitting DTE to MH');
    
    // Ejecutar workflow completo
    const result = await (dteGraph as any).invoke({
      ...INITIAL_STATE,
      dte,
      passwordPri,
      ambiente,
      flowType: 'emission'
    });
    
    res.json({
      transmitted: result.isTransmitted,
      mhResponse: result.mhResponse,
      signature: result.signature,
      isOffline: result.isOffline,
      contingencyReason: result.contingencyReason
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dte/process
router.post('/process', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request: ProcessDTERequest = req.body;
    
    // Validar campos requeridos
    if (!request.dte || !request.businessId) {
      throw createError('Faltan campos requeridos: dte, businessId', 400);
    }

    // Extraer código de generación del DTE
    const codigoGeneracion = request.dte.identificacion?.codigoGeneracion;
    if (!codigoGeneracion) {
      throw createError('El DTE no tiene código de generación', 400);
    }

    logger.info('Iniciando procesamiento DTE', { 
      codigoGeneracion, 
      businessId: request.businessId,
      flowType: request.flowType 
    });

    // Crear estado inicial para LangGraph
    const initialState: Partial<DTEState> = {
      dte: request.dte,
      passwordPri: request.passwordPri, // Puede ser null, lo sacará de Supabase
      ambiente: request.ambiente || '00',
      flowType: request.flowType || 'emission',
      businessId: request.businessId,
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
      status: result.status,
      success: response.success
    });

    res.json(response);

  } catch (error: any) {
    logger.error('Error en procesamiento DTE', { error: error.message });
    next(error);
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
 * Consulta el estado actual de un DTE específico
 */
router.get('/:codigoGeneracion/status', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { codigoGeneracion } = req.params;
      const businessId = req.headers['x-business-id'] as string;

      if (!businessId) {
        throw createError('Se requiere x-business-id header', 400);
      }

      // Consultar estado actual del DTE
      const dteDoc = await getDTEDocument(codigoGeneracion);
      
      if (!dteDoc) {
        throw createError('DTE no encontrado', 404);
      }

      // Verificar que pertenezca al negocio
      if (dteDoc.business_id !== businessId) {
        throw createError('No autorizado para acceder a este DTE', 403);
      }

      const status = {
        codigoGeneracion,
        estado: dteDoc.estado,
        tipoDte: dteDoc.tipo_dte,
        claseDocumento: dteDoc.clase_documento,
        createdAt: dteDoc.created_at,
        updatedAt: dteDoc.updated_at,
        
        // Respuesta de MH si está disponible
        mhResponse: dteDoc.mh_response ? {
          estado: dteDoc.mh_response.estado,
          selloRecepcion: dteDoc.mh_response.selloRecepcion,
          fechaHoraRecepcion: dteDoc.mh_response.fhProcesamiento,
          mensaje: dteDoc.mh_response.mensaje
        } : null,
        
        // URLs de documentos
        documentos: {
          pdf: dteDoc.pdf_url,
          xml: dteDoc.xml_url,
          json: dteDoc.json_url
        }
      };

      res.json(status);

    } catch (error: any) {
      logger.error('Error consultando estado DTE', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/business/:businessId/dtes
 * Lista DTEs de un negocio con filtros opcionales
 */
router.get('/business/:businessId/dtes', 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.params;
      const { 
        estado, 
        tipo, 
        clase, 
        limit = '50', 
        offset = '0' 
      } = req.query;

      // Opciones de filtrado
      const options = {
        tipoDte: tipo as string,
        claseDocumento: clase as string,
        estado: estado as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      // Obtener DTEs del negocio
      const dtes = await getDTEsByBusiness(businessId, options);

      const response = {
        businessId,
        dtes: dtes.map(doc => ({
          codigoGeneracion: doc.codigo_generacion,
          tipoDte: doc.tipo_dte,
          numeroControl: doc.numero_control,
          estado: doc.estado,
          claseDocumento: doc.clase_documento,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          
          // Información básica de MH
          selloRecibido: doc.sello_recibido,
          fhProcesamiento: doc.fh_procesamiento,
          
          // URLs si están disponibles
          tienePdf: !!doc.pdf_url,
          tieneXml: !!doc.xml_url,
          tieneJson: !!doc.json_url
        })),
        total: dtes.length,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: dtes.length === options.limit
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
 * POST /api/dte/:codigoGeneracion/retry
 * Reintenta la transmisión de un DTE en contingencia
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
      const dteDoc = await getDTEDocument(codigoGeneracion);
      
      if (!dteDoc) {
        throw createError('DTE no encontrado', 404);
      }

      if (dteDoc.business_id !== businessId) {
        throw createError('No autorizado para acceder a este DTE', 403);
      }

      if (dteDoc.estado !== 'contingency') {
        throw createError('Solo se pueden reintentar DTEs en contingencia', 400);
      }

      logger.info('Reintentando transmisión DTE', { codigoGeneracion, businessId });

      // Aquí reprocesaríamos el DTE con el workflow
      // Por ahora actualizamos el estado a transmitting
      await updateDTEDocumentStatus(codigoGeneracion, 'transmitting');

      const result = {
        success: true,
        message: 'Reintentando transmisión',
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
