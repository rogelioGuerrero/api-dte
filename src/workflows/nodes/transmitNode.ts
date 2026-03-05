import { DTEState } from "../state";
import { transmitirDTESandbox } from "../../mh/sandboxClient";
import { createLogger } from '../../utils/logger';
import { getMHCredentialsByNIT, updateMHTokenByNIT } from '../../business/businessStorage';
import { randomUUID } from 'crypto';
import { getCachedMHAuthToken, normalizeBearerToken, requestMHAuthToken, shouldRefreshTokenWithExp } from '../../mh/authClient';
import { saveSignedDteDebug } from '../../database/debugLogger';

const decodeJwsPayload = (jws: string) => {
  try {
    const parts = jws.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

const logger = createLogger('transmitNode');

export const transmitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📡 Transmisor: Enviando a Ministerio de Hacienda...");

  if (!state.signature) {
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_NO_SIGNATURE',
      errorMessage: 'No hay firma JWS para transmitir',
      canRetry: true,
      progressPercentage: 50
    };
  }

  if (!state.dte) {
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_NO_DTE',
      errorMessage: 'No hay DTE en el estado para extraer metadata',
      canRetry: true,
      progressPercentage: 50
    };
  }

  try {
    // Log del DTE que se enviará a MH (normalizado y firmado)
    try {
      const resumen = state.dte.resumen || {};
      const items = (state.dte.cuerpoDocumento || []).map((i: any) => ({
        numItem: i.numItem,
        ventaGravada: i.ventaGravada,
        ivaItem: i.ivaItem,
        precioUni: i.precioUni,
        cantidad: i.cantidad,
      }));
      logger.info('DTE listo para transmitir (payload base)', {
        identificacion: state.dte.identificacion,
        resumen,
        items,
      });
    } catch (e) {
      logger.warn('No se pudo loggear DTE listo para transmitir', { error: (e as any)?.message });
    }

    const ambiente = state.ambiente || '00';
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
    const nitLimpioBusqueda = nitEmisor || (state.businessId || '').toString().replace(/[^0-9]/g, '').trim();
    
    // Obtener credenciales para extraer el token
    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, ambiente);

    if (!credentials) {
      console.error('❌ TransmitNode: sin credenciales MH', { nitLimpioBusqueda, ambiente });
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${nitLimpioBusqueda} no tiene credenciales activas para ambiente ${ambiente}`,
        canRetry: false,
        progressPercentage: 50
      };
    }

    console.log('🔐 Credenciales MH obtenidas', { businessId: credentials.business_id, nit: credentials.nit, ambiente });

    let apiToken = normalizeBearerToken(credentials.api_token);

    if (shouldRefreshTokenWithExp(credentials.api_token, credentials.api_token_expires_at, ambiente)) {
      console.log(`🔄 Token necesita refresh para NIT ${nitLimpioBusqueda}`);
      
      if (!credentials.api_password) {
        console.error(`❌ No api_password para NIT ${nitLimpioBusqueda}`);
        return {
          status: 'failed',
          errorCode: 'TRANSMIT_ERROR_NO_API_PASSWORD',
          errorMessage: 'No hay contraseña API configurada para obtener token MH',
          canRetry: false,
          progressPercentage: 50
        };
      }

      const { token } = await getCachedMHAuthToken(nitLimpioBusqueda, credentials.api_password, ambiente);
      apiToken = token;
      console.log(`💾 Guardando token actualizado en BD...`);
      await updateMHTokenByNIT(nitLimpioBusqueda, ambiente, apiToken, undefined);
    }
    
    // Extraer metadata necesaria para el MH
    const version = state.dte.identificacion?.version || 1; // Usar versión declarada en el DTE
    const tipoDte = state.dte.identificacion?.tipoDte || '01'; // Default CCF
    const codigoGeneracion = state.dte.identificacion?.codigoGeneracion || randomUUID(); // Usar el mismo del DTE o generar uno
    const idEnvio = Math.floor(Math.random() * 999999) + 1; // MH espera número entero, no UUID

    // Transmisión real
    const decoded = decodeJwsPayload(state.signature);
    if (decoded) {
      try {
        const resumenDbg = decoded.resumen || {};
        const itemsDbg = (decoded.cuerpoDocumento || []).map((i: any) => ({ numItem: i.numItem, ventaGravada: i.ventaGravada, ivaItem: i.ivaItem }));
        logger.info('DEBUG JWS PAYLOAD', {
          resumen: {
            totalGravada: resumenDbg.totalGravada,
            totalExenta: resumenDbg.totalExenta,
            totalNoSuj: resumenDbg.totalNoSuj,
            totalIva: resumenDbg.totalIva,
            montoTotalOperacion: resumenDbg.montoTotalOperacion,
            totalPagar: resumenDbg.totalPagar,
          },
          items: itemsDbg,
        });
        await saveSignedDteDebug({
          codigoGeneracion,
          signature: state.signature,
          payload: decoded,
        });
      } catch (e) {
        logger.warn('No se pudo loggear payload decodificado', { error: (e as any)?.message });
      }
    }

    const sendWithToken = async (token: string) => transmitirDTESandbox(
      state.signature,
      ambiente,
      token,
      version,
      tipoDte,
      idEnvio,
      codigoGeneracion
    );

    let result = await sendWithToken(apiToken);

    // Si MH responde 401, forzar refresh de token y reintentar una sola vez
    const has401 = Array.isArray(result.errores) && result.errores.some((e: any) => (e.codigo || '').startsWith('HTTP-401'));
    if (has401 && credentials.api_password) {
      try {
        console.log('🔄 401 de MH: forzando refresh de token y reintentando...');
        const newToken = await requestMHAuthToken(nitLimpioBusqueda, credentials.api_password, ambiente);
        apiToken = normalizeBearerToken(newToken);
        await updateMHTokenByNIT(nitLimpioBusqueda, ambiente, apiToken, undefined);
        result = await sendWithToken(apiToken);
      } catch (err: any) {
        console.error('❌ Falló refresh forzado de token MH tras 401', { error: err?.message });
      }
    }
    
    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      
      // El guardado y correo lo maneja emailNode
      
      return {
        isTransmitted: true,
        mhResponse: result,
        status: 'completed',
        progressPercentage: 90,
        currentStep: 'transmitter',
        estimatedTime: 5 // 5 segundos para tax keeper
      };
    } else {
      // Manejo de errores
      console.error("❌ MH Rechazo/Error:", result);

      // Log puntual de IVA normalizado para comparar con MH
      try {
        const items = (state.dte?.cuerpoDocumento || []).map((i: any) => ({
          numItem: i.numItem,
          ventaGravada: i.ventaGravada,
          ivaItem: i.ivaItem,
        }));
        const resumen = state.dte?.resumen;
        logger.info('DEBUG IVA NORMALIZADO', { items, resumen: {
          totalGravada: resumen?.totalGravada,
          totalIva: resumen?.totalIva,
          ivaRete1: resumen?.ivaRete1,
          reteRenta: resumen?.reteRenta,
          montoTotalOperacion: resumen?.montoTotalOperacion,
          totalPagar: resumen?.totalPagar,
        }});
      } catch (e) {
        logger.warn('No se pudo loggear IVA normalizado', { error: (e as any)?.message });
      }
      
      // Detectar errores de negocio MH (estado RECHAZADO) -> no reintentar
      const mhRejected = result.estado === 'RECHAZADO' || (result as any).codigoMsg || (result as any).clasificaMsg;

      // Detectar problemas de conexión o errores 500 para contingencia
      const isCommError = !mhRejected && result.errores?.some((e: any) => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
      
      if (isCommError) {
        if ((state.retryCount || 0) < 2) {
          console.log(`🔄 Error de conexión. Reintentando (${(state.retryCount || 0) + 1}/3)...`);
          return {
            retryCount: (state.retryCount || 0) + 1,
            status: 'transmitting',
            progressPercentage: 60,
            currentStep: 'transmitter',
            estimatedTime: 20 // 20 segundos más
          };
        } else {
          console.warn("⚠️ Timeout/Error Conexión. Activando Contingencia.");
          return {
            status: 'contingency',
            isOffline: true,
            contingencyReason: "Falla de comunicación con MH",
            errorCode: 'TRANSMIT_ERROR_COMMUNICATION',
            errorMessage: 'Falla de comunicación con Ministerio de Hacienda',
            canRetry: true,
            progressPercentage: 70
          };
        }
      }

      // Errores de validación de MH (no reintentables)
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_MH_VALIDATION',
        errorMessage: result.errores?.map(e => `MH [${e.codigo}]: ${e.descripcion}`).join(', ') || result.mensaje || 'Error desconocido MH',
        canRetry: false, // Errores de MH no se reintentan
        progressPercentage: 60
      };
    }
  } catch (error: any) {
    console.error("❌ Error crítico en transmisión:", error);
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_SYSTEM',
      errorMessage: `Error transmisión: ${error.message}`,
      canRetry: true,
      progressPercentage: 60
    };
  }
};
