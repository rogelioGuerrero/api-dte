import { StateGraph, END } from "@langchain/langgraph";
import { DTEState } from "./state";

// Importar Nodos
import { validateNode } from "./nodes/validateNode";
import { signNode } from "./nodes/signNode";
import { transmitNode } from "./nodes/transmitNode";
import { tokenNode } from "./nodes/tokenNode";
import { emailNode } from './nodes/emailNode';
import { persistResponseNode } from './nodes/persistResponseNode';
import { prepareDocumentsNode } from './nodes/prepareDocumentsNode';
import { contingencyNode } from "./nodes/contingencyNode";
import { receptionNode } from "./nodes/receptionNode";
import { taxNode } from "./nodes/taxNode";

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
    apiToken: { reducer: (x: any, y: any) => y ?? x },
    apiTokenExpiresAt: { reducer: (x: any, y: any) => y ?? x },
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
    codigoGeneracion: { reducer: (x: any, y: any) => y ?? x },
    pdfBase64: { reducer: (x: any, y: any) => y ?? x },
    sanitizedDte: { reducer: (x: any, y: any) => y ?? x }
};

const workflow = new StateGraph<DTEState>({ channels })
  .addNode("validator", validateNode)
  .addNode("signer", signNode)
  .addNode("token_manager", tokenNode)
  .addNode("transmitter", transmitNode)
  .addNode("persist_response", persistResponseNode)
  .addNode("prepare_documents", prepareDocumentsNode)
  .addNode("email_sender", emailNode)
  .addNode("contingency", contingencyNode)
  .addNode("reception_processor", receptionNode)
  .addNode("tax_keeper", taxNode)

  // Router Inicial
  .addConditionalEdges("__start__", (state: any) => {
    return state.flowType === 'reception' ? "reception_processor" : "validator";
  })

  // Flujo Emisión
  .addConditionalEdges("validator", (state: any) => {
    console.log('🔀 Validator transition:', { isValid: state.isValid, status: state.status, currentStep: state.currentStep });
    return state.isValid ? "signer" : END;
  })
  .addConditionalEdges("signer", (state: any) => {
    console.log('🔀 Signer transition:', { status: state.status, isSigned: state.isSigned, currentStep: state.currentStep });
    // Si la firma falló o no se generó, terminar (o manejar error)
    if (state.status === 'failed' || !state.isSigned) return END;
    return "token_manager";
  })
  .addConditionalEdges("token_manager", (state: any) => {
    console.log('🔀 Token Manager transition:', { status: state.status, currentStep: state.currentStep });
    if (state.status === 'failed') return END;
    return "transmitter";
  })
  .addConditionalEdges("transmitter", (state: any) => {
    console.log('🔀 Transmitter transition:', { status: state.status, isTransmitted: state.isTransmitted, currentStep: state.currentStep });
      if (state.status === 'completed') return "persist_response";
      if (state.status === 'contingency') return "contingency";
      if (state.status === 'transmitting') return "transmitter"; 
      return END;
  })
  .addEdge("persist_response", "prepare_documents")
  .addEdge("prepare_documents", "email_sender")
  .addEdge("email_sender", "tax_keeper")
  .addEdge("contingency", "tax_keeper")
  
  // Flujo Recepción
  .addEdge("reception_processor", "tax_keeper")
  
  .addEdge("tax_keeper", END);

export const dteGraph = workflow.compile();
