import { END } from "@langchain/langgraph";
import { DTEState } from "./state";

export const WORKFLOW_NODES = {
  VALIDATOR: "validator",
  POST_VALIDATION_PROBE: "post_validation_probe",
  RESERVE_CONTROL_NUMBER: "reserve_control_number",
  SIGNER: "signer",
  TOKEN_MANAGER: "token_manager",
  TRANSMITTER: "transmitter",
  PERSIST_RESPONSE: "persist_response",
  PREPARE_DOCUMENTS: "prepare_documents",
  EMAIL_SENDER: "email_sender",
  CONTINGENCY: "contingency",
  TAX_KEEPER: "tax_keeper",
} as const;

export type WorkflowNode = typeof WORKFLOW_NODES[keyof typeof WORKFLOW_NODES];
export type WorkflowRouteTarget = WorkflowNode | typeof END;

const shouldStopAfterValidation = (state: DTEState): boolean => {
  return state.status === 'failed' || state.isValid === false;
};

const shouldStopAfterSignature = (state: DTEState): boolean => {
  return state.status === 'failed' || state.isSigned === false;
};

const shouldStopAfterToken = (state: DTEState): boolean => {
  return state.status === 'failed';
};

export const routeAfterStart = (): WorkflowRouteTarget => WORKFLOW_NODES.VALIDATOR;

export const routeAfterPostValidation = (state: DTEState): WorkflowRouteTarget => {
  if (shouldStopAfterValidation(state)) {
    return END;
  }

  return WORKFLOW_NODES.RESERVE_CONTROL_NUMBER;
};

export const routeAfterReserveControlNumber = (state: DTEState): WorkflowRouteTarget => {
  if (state.status === 'failed') {
    return END;
  }

  return WORKFLOW_NODES.SIGNER;
};

export const routeAfterSigner = (state: DTEState): WorkflowRouteTarget => {
  if (shouldStopAfterSignature(state)) {
    return END;
  }

  return WORKFLOW_NODES.TOKEN_MANAGER;
};

export const routeAfterTokenManager = (state: DTEState): WorkflowRouteTarget => {
  if (shouldStopAfterToken(state)) {
    return END;
  }

  return WORKFLOW_NODES.TRANSMITTER;
};

export const routeAfterTransmitter = (state: DTEState): WorkflowRouteTarget => {
  if (state.status === 'completed') {
    return WORKFLOW_NODES.PERSIST_RESPONSE;
  }

  if (state.status === 'contingency') {
    return WORKFLOW_NODES.CONTINGENCY;
  }

  if (state.status === 'transmitting') {
    return WORKFLOW_NODES.TRANSMITTER;
  }

  return END;
};
