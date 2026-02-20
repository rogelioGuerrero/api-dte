export type MHMode = 'sandbox' | 'prod';

export const getMHMode = (): MHMode => {
  const raw = process.env.MH_MODE || process.env.NODE_ENV;
  if (raw === 'prod') return 'prod';
  return 'sandbox';
};
