import { StateGraph, END, Annotation } from "@langchain/langgraph";
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

const StateAnnotation = Annotation.Root({
  dte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  isValid: Annotation<boolean>({ reducer: (_x: any, y: any) => y }),
  validationErrors: Annotation<string[]>({ reducer: (_x: any, y: any) => y, default: () => [] }),
  isSigned: Annotation<boolean>({ reducer: (_x: any, y: any) => y }),
  signature: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  isTransmitted: Annotation<boolean>({ reducer: (_x: any, y: any) => y }),
  mhResponse: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  apiToken: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  apiTokenExpiresAt: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  isOffline: Annotation<boolean>({ reducer: (_x: any, y: any) => y }),
  contingencyReason: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  taxImpact: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  status: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  retryCount: Annotation<number>({ reducer: (_x: any, y: any) => y, default: () => 0 }),
  rawInput: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  passwordPri: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  ambiente: Annotation<'00' | '01'>({ reducer: (_x: any, y: any) => y }),
  flowType: Annotation<'emission' | 'reception'>({ reducer: (_x: any, y: any) => y }),
  errorCode: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  errorMessage: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  canRetry: Annotation<boolean>({ reducer: (_x: any, y: any) => y }),
  progressPercentage: Annotation<number>({ reducer: (_x: any, y: any) => y }),
  currentStep: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  estimatedTime: Annotation<number>({ reducer: (_x: any, y: any) => y }),
  businessId: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  nit: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  deviceId: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  codigoGeneracion: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  pdfBase64: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  sanitizedDte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
});

const workflow = new StateGraph(StateAnnotation)
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
  .addEdge("validator", "signer")
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
