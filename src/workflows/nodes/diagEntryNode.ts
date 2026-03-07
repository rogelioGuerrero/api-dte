import { DTEState } from "../state";

export const diagEntryNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🧪 DIAG entry node");

  return {
    currentStep: 'diag_entry',
    status: 'validating',
    progressPercentage: 5,
  };
};
