import { processMHResponse, MHErrorResponse } from './mhErrorMapping';

// Interface para respuesta del frontend (contrato API)
export interface DteProcessResponse {
  success: boolean;
  
  // Datos de éxito (si success: true o aceptado con observaciones)
  data?: {
    codigoGeneracion: string;
    selloRecepcion: string;
    pdfUrl?: string;
    xmlUrl?: string;
    jsonUrl?: string;
    fechaHoraRecepcion?: string;
  };
 
  // Objeto de error estructurado (si success: false o hay observaciones)
  error?: ProcessError;
}
 
export interface ProcessError {
  severity: 'error' | 'warning';   // 'warning' es para el código 002 (Aceptado con observaciones)
  category: 'auth' | 'data' | 'math' | 'contingency' | 'network' | 'system';
  code: string;                    // Ej: 'MH_DATA_NIT_NOT_EXISTS'
  userMessage: string;             // Mensaje amigable (Ej: "El NIT no existe...")
  canRetry: boolean;               // Controla si muestro el botón [🔄 Reintentar]
  details?: string[];              // Códigos crudos de MH para debug/soporte técnico
}

// Mapeo de errores de red/sistema para contingencia
export const NetworkErrorMapping = {
  TIMEOUT: {
    severity: 'error' as const,
    category: 'network' as const,
    code: 'MH_TIMEOUT',
    userMessage: 'El Ministerio de Hacienda está tardando demasiado en responder. Tu documento se ha guardado de forma segura y podrás enviarlo más tarde.',
    canRetry: true,
    details: ['Timeout after 8000ms']
  },
  CONNECTION_ERROR: {
    severity: 'error' as const,
    category: 'network' as const,
    code: 'MH_CONNECTION_ERROR',
    userMessage: 'No se puede conectar con el Ministerio de Hacienda. Verifica tu conexión a internet o intenta más tarde.',
    canRetry: true,
    details: ['Connection failed']
  },
  SERVER_ERROR: {
    severity: 'error' as const,
    category: 'system' as const,
    code: 'MH_SERVER_ERROR',
    userMessage: 'El servidor del Ministerio de Hacienda tiene problemas técnicos. Tu documento está seguro y podrás reintentar.',
    canRetry: true,
    details: ['HTTP 5xx error']
  }
};

// Función para crear respuesta estandarizada
export const createProcessResponse = (result: any): DteProcessResponse => {
  // Caso éxito total
  if (result.status === 'completed' && result.mhResponse?.estado === 'PROCESADO') {
    return {
      success: true,
      data: {
        codigoGeneracion: result.codigoGeneracion!,
        selloRecepcion: result.mhResponse.selloRecepcion,
        pdfUrl: result.mhResponse.pdf_url,
        xmlUrl: result.mhResponse.xml_url,
        jsonUrl: result.mhResponse.json_url,
        fechaHoraRecepcion: result.mhResponse.fhProcesamiento
      }
    };
  }

  // Caso aceptado con observaciones (código 002)
  if (result.status === 'completed' && result.mhResponse?.estado === 'RECIBIDO_CON_OBSERVACIONES') {
    const mhErrors = processMHResponse(result.mhResponse);
    const observation = mhErrors.observations?.[0];
    
    return {
      success: true,
      data: {
        codigoGeneracion: result.codigoGeneracion!,
        selloRecepcion: result.mhResponse.selloRecepcion,
        pdfUrl: result.mhResponse.pdf_url,
        xmlUrl: result.mhResponse.xml_url,
        jsonUrl: result.mhResponse.json_url,
        fechaHoraRecepcion: result.mhResponse.fhProcesamiento
      },
      error: {
        severity: 'warning',
        category: 'data',
        code: observation?.code || 'MH_RECEIVED_WITH_OBSERVATIONS',
        userMessage: observation?.userMessage || 'Hacienda aceptó tu documento con observaciones.',
        canRetry: false,
        details: observation ? ['Código 002: Recibido con observaciones'] : undefined
      }
    };
  }

  // Caso errores de MH
  if (result.status === 'failed' && result.mhResponse?.errores) {
    const mhErrors = processMHResponse(result.mhResponse);
    const mainError = mhErrors.errors?.[0];
    
    if (mainError) {
      return {
        success: false,
        error: {
          severity: 'error',
          category: mapCategoryToContract(mainError.category),
          code: mainError.code,
          userMessage: mainError.userMessage,
          canRetry: mainError.canRetry,
          details: mainError.message ? [mainError.message] : undefined
        }
      };
    }
  }

  // Caso errores de red/timeout (contingencia)
  if (result.status === 'contingency') {
    const networkError = NetworkErrorMapping.TIMEOUT; // Default a timeout
    
    return {
      success: false,
      error: {
        severity: networkError.severity,
        category: networkError.category,
        code: networkError.code,
        userMessage: result.contingencyReason || networkError.userMessage,
        canRetry: networkError.canRetry,
        details: networkError.details
      }
    };
  }

  // Caso errores del sistema (validación, firma, etc.)
  if (result.status === 'failed') {
    return {
      success: false,
      error: {
        severity: 'error',
        category: 'system',
        code: result.errorCode || 'SYSTEM_ERROR',
        userMessage: result.errorMessage || 'Error interno del sistema',
        canRetry: result.canRetry || false,
        details: result.validationErrors || undefined
      }
    };
  }

  // Default - estado desconocido
  return {
    success: false,
    error: {
      severity: 'error',
      category: 'system',
      code: 'UNKNOWN_ERROR',
      userMessage: 'Error desconocido. Por favor intenta nuevamente.',
      canRetry: true,
      details: [`Status: ${result.status}`]
    }
  };
};

// Mapeo de categorías internas a contrato del frontend
const mapCategoryToContract = (internalCategory: string): ProcessError['category'] => {
  const categoryMap: Record<string, ProcessError['category']> = {
    'auth': 'auth',
    'data': 'data',
    'date': 'math',
    'calculation': 'math',
    'contingency': 'contingency',
    'technical': 'system',
    'warning': 'data'
  };
  
  return categoryMap[internalCategory] || 'system';
};
