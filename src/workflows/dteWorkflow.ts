import { StateGraph, END, START, Annotation } from "@langchain/langgraph";

// Importar Nodos
import { validateNode } from "./nodes/validateNode";
import { signNode } from "./nodes/signNode";
import { transmitNode } from "./nodes/transmitNode";
import { tokenNode } from "./nodes/tokenNode";
import { emailNode } from './nodes/emailNode';
import { persistResponseNode } from './nodes/persistResponseNode';
import { prepareDocumentsNode } from './nodes/prepareDocumentsNode';
import { reserveControlNumberNode } from './nodes/reserveControlNumberNode';
import { contingencyNode } from "./nodes/contingencyNode";
import { taxNode } from "./nodes/taxNode";
import { postValidationProbeNode } from "./nodes/postValidationProbeNode";
import {
  WORKFLOW_NODES,
  routeAfterPostValidation,
  routeAfterReserveControlNumber,
  routeAfterSigner,
  routeAfterStart,
  routeAfterTokenManager,
  routeAfterTransmitter,
} from "./workflowRoutes";

const StateAnnotation = Annotation.Root({
  dte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  inputDte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  preparedDte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
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
  reservedCorrelativo: Annotation<number>({ reducer: (_x: any, y: any) => y }),
  reservedNumeroControl: Annotation<string>({ reducer: (_x: any, y: any) => y }),
});

const workflow = new StateGraph(StateAnnotation)
  .addNode(WORKFLOW_NODES.VALIDATOR, validateNode)
  .addNode(WORKFLOW_NODES.POST_VALIDATION_PROBE, postValidationProbeNode)
  .addNode(WORKFLOW_NODES.RESERVE_CONTROL_NUMBER, reserveControlNumberNode)
  .addNode(WORKFLOW_NODES.SIGNER, signNode)
  .addNode(WORKFLOW_NODES.TOKEN_MANAGER, tokenNode)
  .addNode(WORKFLOW_NODES.TRANSMITTER, transmitNode)
  .addNode(WORKFLOW_NODES.PERSIST_RESPONSE, persistResponseNode)
  .addNode(WORKFLOW_NODES.PREPARE_DOCUMENTS, prepareDocumentsNode)
  .addNode(WORKFLOW_NODES.EMAIL_SENDER, emailNode)
  .addNode(WORKFLOW_NODES.CONTINGENCY, contingencyNode)
  .addNode(WORKFLOW_NODES.TAX_KEEPER, taxNode)

  // Router Inicial de emisión
  .addConditionalEdges(START, () => {
    console.log('🔀 Start router: usando validator estándar');
    return routeAfterStart();
  })

  // Flujo Emisión
  .addEdge(WORKFLOW_NODES.VALIDATOR, WORKFLOW_NODES.POST_VALIDATION_PROBE)
  .addConditionalEdges(WORKFLOW_NODES.POST_VALIDATION_PROBE, (state: any) => {
    console.log('🔀 Post-Validation transition check:', { 
      isValid: state.isValid, 
      status: state.status,
      validationErrors: state.validationErrors?.length 
    });
    
    // Si la validación falló, terminamos el flujo aquí retornando los errores
    if (state.status === 'failed' || state.isValid === false) {
      console.log('⛔ Validación fallida. Deteniendo flujo antes de firmar.');
      return routeAfterPostValidation(state);
    }

    return routeAfterPostValidation(state);
  })

  .addConditionalEdges(WORKFLOW_NODES.RESERVE_CONTROL_NUMBER, (state: any) => {
    console.log('🔀 Reserve Control Number transition:', { status: state.status, currentStep: state.currentStep });
    return routeAfterReserveControlNumber(state);
  })

  .addConditionalEdges(WORKFLOW_NODES.SIGNER, (state: any) => {
    console.log('🔀 Signer transition:', { status: state.status, isSigned: state.isSigned, currentStep: state.currentStep });
    // Si la firma falló o no se generó, terminar (o manejar error)
    return routeAfterSigner(state);
  })
  .addConditionalEdges(WORKFLOW_NODES.TOKEN_MANAGER, (state: any) => {
    console.log('🔀 Token Manager transition:', { status: state.status, currentStep: state.currentStep });
    return routeAfterTokenManager(state);
  })
  .addConditionalEdges(WORKFLOW_NODES.TRANSMITTER, (state: any) => {
    console.log('🔀 Transmitter transition:', { status: state.status, isTransmitted: state.isTransmitted, currentStep: state.currentStep });
      return routeAfterTransmitter(state);
  })
  .addEdge(WORKFLOW_NODES.PERSIST_RESPONSE, WORKFLOW_NODES.PREPARE_DOCUMENTS)
  .addEdge(WORKFLOW_NODES.PREPARE_DOCUMENTS, WORKFLOW_NODES.EMAIL_SENDER)
  .addEdge(WORKFLOW_NODES.EMAIL_SENDER, WORKFLOW_NODES.TAX_KEEPER)
  .addEdge(WORKFLOW_NODES.CONTINGENCY, WORKFLOW_NODES.TAX_KEEPER)

  .addEdge(WORKFLOW_NODES.TAX_KEEPER, END);

export const dteGraph = workflow.compile();
