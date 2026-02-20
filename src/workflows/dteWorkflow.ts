import { StateGraph, END } from "@langchain/langgraph";
import { DTEState } from "./state";
import { convertirAContingencia } from "../dte/generator";
import { updateTaxAccumulator, createEmptyAccumulator, getPeriodFromDate } from "../tax/taxCalculator";
import { getAccumulator, saveAccumulator } from '../tax/taxStorage';
import { getMHCredentials } from '../business/businessStorage';
import { saveDTEDocument } from "../dte/dteStorage";
import { firmarDocumento, limpiarDteParaFirma, wakeFirmaService } from "../integrations/firmaClient";
import { processDTE } from "../mh/process";
import { transmitirDTESandbox } from "../mh/sandboxClient";
import { TransmisionResult } from "../types/types";

// --- NODES ---

// 1. Validator Node ("Agente Validador")
const validateNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🕵️ Agente Validador: Revisando estructura y reglas de negocio...");
  
  const dte = state.dte;
  if (!dte) {
    return { 
      isValid: false, 
      validationErrors: ["No se proporcionó un objeto DTE"], 
      status: 'failed',
      errorCode: 'VALIDATION_ERROR_NO_DTE',
      errorMessage: 'No se proporcionó un objeto DTE',
      canRetry: true,
      progressPercentage: 5
    };
  }

  try {
    // Usar el validador real del sistema
    const processed = processDTE(dte);
    
    if (processed.errores.length > 0) {
      console.warn("❌ Agente Validador: DTE Rechazado", processed.errores);
      return {
        isValid: false,
        validationErrors: processed.errores.map(e => `${e.campo}: ${e.descripcion}`),
        status: 'failed',
        errorCode: 'VALIDATION_ERROR_FIELDS',
        errorMessage: 'El DTE tiene campos inválidos',
        canRetry: true,
        progressPercentage: 20
      };
    }

    console.log("✅ Agente Validador: DTE Aprobado");
    return {
      isValid: true,
      validationErrors: [],
      status: 'signing',
      progressPercentage: 25,
      currentStep: 'validator',
      estimatedTime: 45 // 45 segundos restantes
    };
  } catch (error: any) {
    console.error("❌ Error en validación:", error);
    return {
      status: 'failed',
      errorCode: 'VALIDATION_ERROR_SYSTEM',
      errorMessage: 'Error del sistema al validar DTE',
      canRetry: true,
      progressPercentage: 20
    };
  }
};

// 2. Signer Node ("Nodo Firmador")
const signNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("✍️ Nodo Firmador: Solicitando firma electrónica...");
  
  if (!state.dte) { 
    return { 
      status: 'failed',
      errorCode: 'SIGN_ERROR_NO_DTE',
      errorMessage: 'No hay DTE para firmar',
      canRetry: true,
      progressPercentage: 25
    };
  }

  try {
    // Asegurar que el servicio de firma esté despierto
    await wakeFirmaService({ retries: 3, baseDelayMs: 2000, timeoutMs: 60000 });

    const processed = processDTE(state.dte);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    // Obtener las credenciales del negocio para sacar el token y la contraseña de firma
    const credentials = await getMHCredentials(state.businessId!, state.ambiente || '00');
    
    if (!credentials) {
      console.error(`❌ No hay credenciales en Supabase para el NIT: ${state.businessId!}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${state.businessId!} no está registrado o no tiene credenciales activas en Supabase para el ambiente ${state.ambiente || '00'}`,
        canRetry: false,
        progressPercentage: 25
      };
    }

    // Usar la contraseña del request (si viene, para retrocompatibilidad/pruebas) o la guardada en Supabase
    const finalPasswordPri = state.passwordPri || credentials.password_pri;

    if (!finalPasswordPri) {
      console.error(`❌ No hay contraseña configurada en Supabase para el NIT: ${state.businessId!}`);
      return { 
        status: 'failed', 
        errorCode: 'SIGN_ERROR_NO_PASSWORD',
        errorMessage: 'La contraseña del certificado no está configurada en la base de datos para este NIT',
        canRetry: false,
        progressPercentage: 25
      };
    }

    // Ejecutar firma real
    const jwsFirmado = await firmarDocumento({
      nit: nitEmisor,
      passwordPri: finalPasswordPri,
      dteJson: dteLimpio,
      apiToken: credentials.api_token // Pasamos el token del negocio
    });

    console.log("✅ Firma exitosa");
    return {
      isSigned: true,
      signature: jwsFirmado,
      status: 'transmitting',
      progressPercentage: 50,
      currentStep: 'signer',
      estimatedTime: 30 // 30 segundos restantes
    };
  } catch (error: any) {
    console.error("❌ Error de firma:", error);
    return {
      status: 'failed',
      errorCode: 'SIGN_ERROR_SERVICE',
      errorMessage: `Error al firmar: ${error.message || 'Desconocido'}`,
      canRetry: true,
      progressPercentage: 40
    };
  }
};

// 3. Transmitter Node ("Transmisor Inteligente")
const transmitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
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

  try {
    const ambiente = state.ambiente || '00';
    
    // Transmisión real
    const result = await transmitirDTESandbox(state.signature, ambiente);
    
    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      
      // Guardar documento procesado
      if (state.businessId && state.codigoGeneracion) {
        await saveDTEDocument({
          codigo_generacion: state.codigoGeneracion,
          tipo_dte: state.dte!.identificacion.tipoDte,
          numero_control: state.dte!.identificacion.numeroControl,
          estado: 'processed',
          dte_json: state.dte!,
          firma_jws: state.signature,
          mh_response: result,
          business_id: state.businessId,
          issuer_nit: state.dte!.emisor.nit,
          clase_documento: 'emitido',
          sello_recibido: result.selloRecepcion,
          fh_procesamiento: result.fechaHoraRecepcion
        });
      }

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
      
      // Detectar problemas de conexión o errores 500 para contingencia
      const isCommError = result.errores?.some(e => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
      
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

// 4. Contingency Node ("Gestor de Contingencia")
const contingencyNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📦 Gestor Contingencia: Transformando a Modelo Diferido...");
  
  if (!state.dte || !state.passwordPri) return { status: 'failed' };

  try {
    // Transformar DTE a Contingencia
    const dteContingencia = convertirAContingencia(state.dte, state.contingencyReason);
    
    // Volver a procesar y firmar el DTE de contingencia
    const processed = processDTE(dteContingencia);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    const jwsContingencia = await firmarDocumento({
      nit: nitEmisor,
      passwordPri: state.passwordPri,
      dteJson: dteLimpio,
    });

    console.log("💾 DTE Contingencia firmado y listo.");
    
    // Guardar documento en contingencia
    await saveDTEDocument({
      codigo_generacion: dteContingencia.identificacion.codigoGeneracion,
      tipo_dte: dteContingencia.identificacion.tipoDte,
      numero_control: dteContingencia.identificacion.numeroControl,
      estado: 'contingency',
      dte_json: dteContingencia,
      firma_jws: jwsContingencia,
      mh_response: undefined, // No hay respuesta de MH aún
      business_id: state.businessId!,
      issuer_nit: nitEmisor,
      clase_documento: 'emitido'
    });

    return {
      dte: dteContingencia,
      signature: jwsContingencia,
      isOffline: true,
      status: 'completed', // Marcamos como completado para el usuario (tiene su DTE firmado)
      contingencyReason: state.contingencyReason,
      // Simulamos respuesta exitosa local
      mhResponse: {
        success: false,
        estado: 'CONTINGENCIA',
        mensaje: 'Documento en contingencia',
        fechaHoraRecepcion: new Date().toISOString()
      } as TransmisionResult
    };
  } catch (error: any) {
    return {
      status: 'failed',
      validationErrors: [`Error generando contingencia: ${error.message}`]
    };
  }
};

// 6. Reception Node ("Procesador de Compras")
const receptionNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📥 Procesador de Recepción: Analizando documento recibido...");

  if (!state.dte) {
    // Intentar parsear rawInput si dte es nulo (caso de carga de JSON)
    if (state.rawInput) {
       try {
         // Aquí se podría agregar lógica para decodificar JWS si viene firmado
         // Por ahora asumimos que rawInput es el objeto DTE o un JSON string
         const dte = typeof state.rawInput === 'string' ? JSON.parse(state.rawInput) : state.rawInput;
         return {
           dte,
           isValid: true, // Asumimos válido si viene de otro emisor (o agregar validación firma)
           status: 'completed'
         };
       } catch (e) {
         return { status: 'failed', validationErrors: ["Error parseando JSON recibido"] };
       }
    }
    return { status: 'failed', validationErrors: ["No se proporcionó DTE de compra"] };
  }

  return {
    status: 'completed',
    isValid: true
  };
};

// 5. Tax Keeper Node
const taxNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log(`📊 Contador Autónomo (${state.flowType || 'emission'}): Actualizando libros...`);
  
  if (state.status !== 'completed' || !state.dte) {
    return {};
  }

  try {
    const period = getPeriodFromDate(state.dte.identificacion.fecEmi);
    const existingAcc = await getAccumulator(state.businessId!, period.key, 'ALL');
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
    const baseAcc = existingAcc || createEmptyAccumulator(period, state.businessId!);
    
    // Pasamos el flowType para distinguir si suma a Ventas o Compras
    const updatedAcc = updateTaxAccumulator(baseAcc, state.dte, state.flowType);
    
    await saveAccumulator(updatedAcc);

    console.log(`💰 Impacto Fiscal Guardado: ${state.flowType === 'reception' ? 'Crédito' : 'Débito'} actualizado.`);

    // Eliminamos referencia a window ya que no existe en backend

    return {
      taxImpact: updatedAcc
    };
  } catch (error) {
    console.error("❌ Error en Contador Autónomo:", error);
    return {};
  }
};

// --- GRAPH DEFINITION ---
// Casting channels to any to avoid strict type inference issues with LangGraph reducers
const channels: any = {
    dte: { reducer: (x: any, y: any) => y ?? x },
    isValid: { reducer: (x: any, y: any) => y ?? x },
    validationErrors: { reducer: (x: any, y: any) => y ?? x },
    isSigned: { reducer: (x: any, y: any) => y ?? x },
    signature: { reducer: (x: any, y: any) => y ?? x },
    isTransmitted: { reducer: (x: any, y: any) => y ?? x },
    mhResponse: { reducer: (x: any, y: any) => y ?? x },
    isOffline: { reducer: (x: any, y: any) => y ?? x },
    contingencyReason: { reducer: (x: any, y: any) => y ?? x },
    taxImpact: { reducer: (x: any, y: any) => y ?? x },
    status: { reducer: (x: any, y: any) => y ?? x },
    retryCount: { reducer: (x: any, y: any) => y ?? x },
    rawInput: { reducer: (x: any, y: any) => y ?? x },
    passwordPri: { reducer: (x: any, y: any) => y ?? x },
    ambiente: { reducer: (x: any, y: any) => y ?? x },
    flowType: { reducer: (x: any, y: any) => y ?? x },
    errorCode: { reducer: (x: any, y: any) => y ?? x },
    errorMessage: { reducer: (x: any, y: any) => y ?? x },
    canRetry: { reducer: (x: any, y: any) => y ?? x },
    progressPercentage: { reducer: (x: any, y: any) => y ?? x },
    currentStep: { reducer: (x: any, y: any) => y ?? x },
    estimatedTime: { reducer: (x: any, y: any) => y ?? x },
    businessId: { reducer: (x: any, y: any) => y ?? x },
    deviceId: { reducer: (x: any, y: any) => y ?? x },
    codigoGeneracion: { reducer: (x: any, y: any) => y ?? x }
};

const workflow = new StateGraph<DTEState>({ channels })
  .addNode("validator", validateNode)
  .addNode("signer", signNode)
  .addNode("transmitter", transmitNode)
  .addNode("contingency", contingencyNode)
  .addNode("reception_processor", receptionNode)
  .addNode("tax_keeper", taxNode)

  // Router Inicial
  .addConditionalEdges("__start__", (state: any) => {
    return state.flowType === 'reception' ? "reception_processor" : "validator";
  })

  // Flujo Emisión
  .addConditionalEdges("validator", (state: any) => state.isValid ? "signer" : END)
  .addConditionalEdges("signer", (state: any) => {
    // Si la firma falló o no se generó, terminar (o manejar error)
    if (state.status === 'failed' || !state.isSigned) return END;
    return "transmitter";
  })
  .addConditionalEdges("transmitter", (state: any) => {
      if (state.status === 'completed') return "tax_keeper";
      if (state.status === 'contingency') return "contingency";
      if (state.status === 'transmitting') return "transmitter"; 
      return END;
  })
  .addEdge("contingency", "tax_keeper")
  
  // Flujo Recepción
  .addEdge("reception_processor", "tax_keeper")
  
  .addEdge("tax_keeper", END);

export const dteGraph = workflow.compile();
