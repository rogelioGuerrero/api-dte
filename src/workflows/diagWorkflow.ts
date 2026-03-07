import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { INITIAL_STATE } from "./state";
import { diagEntryNode } from "./nodes/diagEntryNode";
import { diagPassNodeA } from "./nodes/diagPassNodeA";
import { diagPassNodeB } from "./nodes/diagPassNodeB";
import { diagExitNode } from "./nodes/diagExitNode";

const DiagState = Annotation.Root({
  dte: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  currentStep: Annotation<string>({ reducer: (_x: any, y: any) => y }),
  status: Annotation<any>({ reducer: (_x: any, y: any) => y }),
  progressPercentage: Annotation<number>({ reducer: (_x: any, y: any) => y }),
});

const diagWorkflow = new StateGraph(DiagState)
  .addNode("diag_entry", diagEntryNode)
  .addNode("diag_a", diagPassNodeA)
  .addNode("diag_b", diagPassNodeB)
  .addNode("diag_exit", diagExitNode)
  .addEdge(START, "diag_entry")
  .addEdge("diag_entry", "diag_a")
  .addEdge("diag_a", "diag_b")
  .addEdge("diag_b", "diag_exit")
  .addEdge("diag_exit", END);

export const diagGraph = diagWorkflow.compile();

export const invokeDiagGraph = async (dte: any) => {
  return diagGraph.invoke({
    ...INITIAL_STATE,
    dte,
    currentStep: 'diag_start',
    status: 'draft',
    progressPercentage: 0,
  } as any);
};
