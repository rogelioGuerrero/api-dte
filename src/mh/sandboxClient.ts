import type { TransmisionResult, AdvertenciaMH, ErrorValidacionMH } from './types';

interface TransmitirResponse {
  estado?: string;
  codigoGeneracion?: string;
  selloRecepcion?: string;
  selloRecibido?: string;
  fechaHoraRecepcion?: string;
  fechaHoraProcesamiento?: string;
  fhProcesamiento?: string;
  numeroControl?: string;
  mensaje?: string;
  descripcionMsg?: string;
  codigoMsg?: string;
  observaciones?: string[];
  enlaceConsulta?: string;
  advertencias?: Array<{ codigo: string; campo?: string; descripcion: string; severidad?: 'BAJA' | 'MEDIA' | 'ALTA' }>;
  errores?: Array<{ codigo: string; campo?: string; descripcion: string; severidad?: string; valorEsperado?: string; valorActual?: string }>;
  [k: string]: unknown;
}

const getProxyUrl = (): string => {
  // Forzar URL de producción para evitar errores de proxy local (404)
  // en entornos donde no se puede reiniciar el servidor de desarrollo.
  const prodUrl = 'https://api-firma.onrender.com/firma';
  console.log('🔌 Usando backend de firma:', prodUrl);
  return prodUrl;
};

const mapErrores = (raw?: TransmitirResponse['errores']): ErrorValidacionMH[] | undefined => {
  if (!raw || raw.length === 0) return undefined;
  return raw.map((e) => ({
    codigo: e.codigo || 'MH-ERROR',
    campo: e.campo,
    descripcion: e.descripcion || 'Error',
    severidad: 'ERROR',
    valorActual: e.valorActual,
    valorEsperado: e.valorEsperado,
  }));
};

const mapAdvertencias = (raw?: TransmitirResponse['advertencias']): AdvertenciaMH[] | undefined => {
  if (!raw || raw.length === 0) return undefined;
  return raw.map((a) => ({
    codigo: a.codigo,
    descripcion: a.descripcion,
    campo: a.campo,
    severidad: a.severidad,
  }));
};

export const consultarDTESandbox = async <T = unknown>(
  codigoGeneracion: string,
  ambiente: '00' | '01' = '00'
): Promise<T> => {
  const baseUrl = getProxyUrl();
  const url = `${baseUrl}/consulta/${encodeURIComponent(codigoGeneracion)}?ambiente=${encodeURIComponent(ambiente)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(`Consulta MH falló (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
};

export const transmitirDTESandbox = async (jws: string, ambiente: '00' | '01' = '00'): Promise<TransmisionResult> => {
  const baseUrl = getProxyUrl();
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 8000;

  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${baseUrl}/transmitir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dte: jws,
          ambiente,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await res.json().catch(() => ({}))) as TransmitirResponse;

      const estadoRaw = (data.estado || '').toUpperCase();
      const estado = (estadoRaw as TransmisionResult['estado']) || 'RECHAZADO';

      const selloRecepcion = (data.selloRecibido || data.selloRecepcion) as string | undefined;
      const fechaHoraProcesamiento = (data.fechaHoraProcesamiento || data.fhProcesamiento) as string | undefined;
      const mensaje = (data.mensaje || data.descripcionMsg) as string | undefined;

      const obsErrores: ErrorValidacionMH[] | undefined = data.observaciones?.length
        ? data.observaciones.map((o) => ({
            codigo: data.codigoMsg || 'MH-OBS',
            descripcion: o,
            severidad: 'ERROR',
          }))
        : undefined;

      const result: TransmisionResult = {
        success: estado === 'PROCESADO' || estado === 'ACEPTADO' || estado === 'ACEPTADO_CON_ADVERTENCIAS',
        estado,
        codigoGeneracion: data.codigoGeneracion,
        selloRecepcion,
        numeroControl: data.numeroControl,
        fechaHoraRecepcion: data.fechaHoraRecepcion,
        fechaHoraProcesamiento,
        mensaje,
        enlaceConsulta: data.enlaceConsulta,
        advertencias: mapAdvertencias(data.advertencias),
        errores: obsErrores || mapErrores(data.errores),
      };

      if (!res.ok) {
        // Si es un error del servidor (5xx) podríamos reintentar, pero por ahora devolvemos el error parseado
        return {
          ...result,
          success: false,
          estado: 'RECHAZADO',
          mensaje: result.mensaje || `Transmisión fallida (${res.status})`,
          errores:
            result.errores && result.errores.length > 0
              ? result.errores
              : [
                  {
                    codigo: `HTTP-${res.status}`,
                    descripcion: 'Error HTTP en transmisión',
                    severidad: 'ERROR',
                  },
                ],
        };
      }

      return result;

    } catch (err: any) {
      lastError = err;
      const isTimeout = err.name === 'AbortError';
      console.warn(`Intento ${attempt}/${MAX_RETRIES} fallido. ${isTimeout ? 'Timeout de 8s' : err.message}`);
      
      // Si es el último intento, no esperamos
      if (attempt < MAX_RETRIES) {
        // Esperar un poco antes de reintentar (exponential backoff opcional, aquí fijo 1s)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Si llegamos aquí, fallaron todos los intentos
  return {
    success: false,
    estado: 'RECHAZADO', // Usamos 'RECHAZADO' ya que 'ERROR' no es un estado válido en el tipo
    mensaje: `Error de comunicación tras ${MAX_RETRIES} intentos: ${lastError?.message || 'Desconocido'}`,
    errores: [
      {
        codigo: 'COM-ERR',
        descripcion: lastError?.name === 'AbortError' 
          ? 'Tiempo de espera agotado (8s) al contactar con MH' 
          : `Error de red: ${lastError?.message}`,
        severidad: 'ERROR',
      },
    ],
  };
};
