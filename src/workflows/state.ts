import { DTEJSON } from '../dte/generator';
import { MonthlyTaxAccumulator } from '../tax/types';

export interface DTEState {
  // Inputs iniciales
  rawInput?: any;           // JSON crudo del frontend
  passwordPri?: string;     // Password para firma
  ambiente?: '00' | '01';   // Pruebas/Producción
  flowType?: 'emission' | 'reception'; // Tipo de flujo
  
  // Identificación para tracking
  codigoGeneracion?: string; // Para fácil identificación
  businessId?: string;       // Para consultas y RLS
  deviceId?: string;         // fingerprint del dispositivo
  
  // Estados por cada nodo
  isValid?: boolean;        // Resultado del validator
  validationErrors?: string[];
  isSigned?: boolean;       // Resultado del signer
  signature?: string;       // JWS firmado
  isTransmitted?: boolean;  // Resultado del transmitter
  mhResponse?: any;         // Respuesta de MH
  
  // Estados especiales
  isOffline?: boolean;      // Contingencia
  contingencyReason?: string;
  taxImpact?: any;          // MonthlyTaxAccumulator
  
  // Control global
  status?: 'draft' | 'validating' | 'signing' | 'transmitting' | 'completed' | 'failed' | 'contingency' | 'processing_reception';
  retryCount?: number;
  
  // Para UI más rica
  progressPercentage?: number; // 0-100
  currentStep?: string;       // "validator", "signer", etc.
  estimatedTime?: number;     // segundos restantes
  
  // Para errores específicos
  errorCode?: string;         // MH_ERROR_106, etc.
  errorMessage?: string;      // Mensaje amigable para usuario
  canRetry?: boolean;         // Si el usuario puede reintentar
  
  // Allow dynamic properties for LangGraph internal state handling
  [key: string]: any;
}

export const INITIAL_STATE: DTEState = {
  flowType: 'emission', // Default a emisión
  isValid: false,
  validationErrors: [],
  isSigned: false,
  isTransmitted: false,
  isOffline: false,
  status: 'draft',
  retryCount: 0,
  ambiente: '00',
  progressPercentage: 0,
  currentStep: 'start',
  estimatedTime: 60, // 60 segundos estimados totales
  canRetry: true
};
