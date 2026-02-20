export type MHMode = 'sandbox' | 'prod';

export const getMHMode = (): MHMode => {
  const raw = (import.meta as any)?.env?.VITE_MH_MODE;
  if (raw === 'sandbox' || raw === 'prod') return raw;
  return 'sandbox';
};
