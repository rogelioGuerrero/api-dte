export interface Settings {
  useAutoDetection: boolean;
  myNit: string;
  myNrc: string;
}

export const loadSettings = (): Settings => {
  return {
    useAutoDetection: process.env.USE_AUTO_DETECTION === 'true',
    myNit: process.env.MY_NIT || '',
    myNrc: process.env.MY_NRC || ''
  };
};
