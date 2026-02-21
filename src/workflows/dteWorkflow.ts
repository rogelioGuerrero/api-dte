import { StateGraph, END } from "@langchain/langgraph";
import { DTEState } from "./state";

// Importar Nodos
import { validateNode } from "./nodes/validateNode";
import { signNode } from "./nodes/signNode";
import { transmitNode } from "./nodes/transmitNode";
import { emailNode } from "./nodes/emailNode";
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
  .addNode("email_sender", emailNode)
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
      if (state.status === 'completed') return "email_sender";
      if (state.status === 'contingency') return "contingency";
      if (state.status === 'transmitting') return "transmitter"; 
      return END;
  })
  .addEdge("email_sender", "tax_keeper")
  .addEdge("contingency", "tax_keeper")
  
  // Flujo Recepción
  .addEdge("reception_processor", "tax_keeper")
  
  .addEdge("tax_keeper", END);

export const dteGraph = workflow.compile();
