export interface DTEIdentificacion {
  fecEmi: string; // YYYY-MM-DD
  tipoDte: string;
  numeroControl: string;
  codigoGeneracion: string;
}

export interface DTEEmisor {
  nit: string;
  nrc: string;
  nombre: string;
} 

export interface DTEReceptor {
  nit?: string;
  nrc: string;
  nombre: string;
  numDocumento?: string; // DUI u otro documento de identificación
}

export interface DTETributo {
  codigo: string;
  valor: number;
}

export interface DTEResumen {
  totalExenta: number;
  totalNoSuj: number;
  totalGravada: number;
  subTotal: number;
  montoTotalOperacion: number;
  tributos: DTETributo[] | null;
}

export interface DTEData {
  identificacion: DTEIdentificacion;
  selloRecibido: string;
  emisor: DTEEmisor; // Added for Purchases (Compras)
  receptor: DTEReceptor; // Used for Sales (Ventas)
  resumen: DTEResumen;
}

export interface ProcessedFile {
  id: string; // Unique identifier for selection
  fileName: string;
  month: string; // MM
  csvLine: string;
  data: {
    date: string;
    controlNumber: string;
    total: string;
    receiver: string; // Acts as "Counterparty" (Client in Sales, Provider in Purchases)
    neto: string; // Base gravada (totalGravada)
    iva: string; // IVA (tributos[0].valor)
    exentas: string; // Ventas/Compras exentas
    descuentos?: string; // Descuentos/rebajas
    tipoDTE?: string; // Tipo de DTE (01, 03, 05, 06)
    codigoGeneracion?: string; // Código de generación
    selloRecibido?: string; // Sello de recepción
  };
  taxpayer?: {
    nombre: string;
    nit: string;
    nrc: string;
  };
  dteType?: string; // '01', '03', etc. to distinguish between books
  isValid: boolean;
  errorMessage?: string;
  detectedMode?: AppMode; // Mode detected in auto-detection (ventas or compras)
  isOutOfTime?: boolean; // true si está fuera del plazo de 3 meses para compras
  originalDte?: DTEData; // Full DTE object for agent processing
}

export interface GroupedData {
  [month: string]: ProcessedFile[];
}

// --- Field Mapping Types ---

export type TransformationType = 'none' | 'date_ddmmyyyy' | 'remove_hyphens' | 'currency' | 'first_element_currency';

export interface FieldDefinition {
  id: string;
  columnLetter: string; // A, B, C...
  label: string; // Human readable name (e.g., "Fecha de Emisión")
  sourceType: 'json' | 'static' | 'conditional';
  value: string; // If json: object path (e.g. 'identificacion.fecEmi'). If static: the constant value. If conditional: field name.
  transformation: TransformationType;
  enabled: boolean;
}

export type FieldConfiguration = FieldDefinition[];

export type AppMode = 'ventas' | 'compras';

// --- Historial de exportaciones (IndexedDB) ---
export interface HistoryEntry {
  id?: number;
  timestamp: number; // Epoch ms
  mode: AppMode; // ventas o compras
  fileName: string; // nombre del CSV generado
  totalAmount: number; // monto total incluido en el archivo
  fileCount: number; // número de documentos incluidos
  hash: string; // hash SHA-256 del contenido CSV
}

// --- Tipos de transmisión ---
export interface TransmisionResult {
  success: boolean;
  estado?: string;
  mensaje?: string;
  selloRecepcion?: string;
  fechaHoraRecepcion?: string;
  errores?: Array<{
    codigo: string;
    descripcion: string;
  }>;
}

// --- Tipos de usuario ---
export interface User {
  id: string;
  email: string;
  nit: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// --- Tipos de API ---
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// --- Tipos de batch processing ---
export interface BatchOperation {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  errors?: any[];
  createdAt: string;
  completedAt?: string;
}