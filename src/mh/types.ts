export interface ErrorValidacionMH {
  codigo: string;
  campo?: string;
  descripcion: string;
  severidad: 'ERROR' | 'ADVERTENCIA';
  valorActual?: string;
  valorEsperado?: string;
}

export interface AdvertenciaMH {
  codigo: string;
  descripcion: string;
  campo?: string;
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA';
}

export interface TransmisionResult {
  success: boolean;
  estado: 'ACEPTADO' | 'ACEPTADO_CON_ADVERTENCIAS' | 'RECHAZADO' | 'PROCESANDO' | 'CONTINGENCIA' | 'PROCESADO';
  codigoGeneracion?: string;
  selloRecepcion?: string;
  numeroControl?: string;
  fechaHoraRecepcion?: string;
  fechaHoraProcesamiento?: string;
  mensaje?: string;
  advertencias?: AdvertenciaMH[];
  errores?: ErrorValidacionMH[];
  enlaceConsulta?: string;
  reintentarEn?: number;
  instrucciones?: string;
}

export type EstadoTransmision =
  | 'pendiente'
  | 'validando'
  | 'firmando'
  | 'transmitiendo'
  | 'procesado'
  | 'rechazado'
  | 'error';

export interface FirmaJWSResult {
  success: boolean;
  jws?: string;
  error?: string;
}
