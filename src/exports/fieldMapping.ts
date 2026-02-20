import { FieldConfiguration, DTEData } from '../types/types';

// --- VENTAS CONFIGURATION (Legacy/Default) ---
// Based on F-07 Manual for Sales
export const VENTAS_CONFIG: FieldConfiguration = [
  { id: 'v1', columnLetter: 'A', label: 'Fecha Emisión', sourceType: 'json', value: 'identificacion.fecEmi', transformation: 'date_ddmmyyyy', enabled: true },
  { id: 'v2', columnLetter: 'B', label: 'Clase Doc', sourceType: 'static', value: '4', transformation: 'none', enabled: true },
  { id: 'v3', columnLetter: 'C', label: 'Tipo DTE', sourceType: 'json', value: 'identificacion.tipoDte', transformation: 'none', enabled: true },
  { id: 'v4', columnLetter: 'D', label: 'Num. Control', sourceType: 'json', value: 'identificacion.numeroControl', transformation: 'remove_hyphens', enabled: true },
  { id: 'v5', columnLetter: 'E', label: 'Sello Recibido', sourceType: 'json', value: 'selloRecibido', transformation: 'none', enabled: true },
  { id: 'v6', columnLetter: 'F', label: 'Cod. Generación', sourceType: 'json', value: 'identificacion.codigoGeneracion', transformation: 'remove_hyphens', enabled: true },
  { id: 'v7', columnLetter: 'G', label: 'Campo Vacío (G)', sourceType: 'static', value: '', transformation: 'none', enabled: true },
  { id: 'v8', columnLetter: 'H', label: 'NRC Cliente', sourceType: 'json', value: 'receptor.nrc', transformation: 'none', enabled: true },
  { id: 'v9', columnLetter: 'I', label: 'Nombre Cliente', sourceType: 'json', value: 'receptor.nombre', transformation: 'none', enabled: true },
  { id: 'v10', columnLetter: 'J', label: 'Total Exenta', sourceType: 'json', value: 'resumen.totalExenta', transformation: 'currency', enabled: true },
  { id: 'v11', columnLetter: 'K', label: 'Total No Sujeta', sourceType: 'json', value: 'resumen.totalNoSuj', transformation: 'currency', enabled: true },
  { id: 'v12', columnLetter: 'L', label: 'Total Gravada', sourceType: 'json', value: 'resumen.totalGravada', transformation: 'currency', enabled: true },
  { id: 'v13', columnLetter: 'M', label: 'Débito Fiscal (IVA)', sourceType: 'json', value: 'resumen.tributos', transformation: 'first_element_currency', enabled: true },
  { id: 'v14', columnLetter: 'N', label: 'Vtas Terceros No Dom', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'v15', columnLetter: 'O', label: 'Debito Vtas Terceros', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'v16', columnLetter: 'P', label: 'Total Ventas', sourceType: 'json', value: 'resumen.montoTotalOperacion', transformation: 'currency', enabled: true },
  { id: 'v17', columnLetter: 'Q', label: 'DUI (Cliente)', sourceType: 'json', value: 'receptor.numDocumento', transformation: 'none', enabled: true },
  { id: 'v18', columnLetter: 'R', label: 'Tipo Operación', sourceType: 'conditional', value: 'tipoOperacion', transformation: 'none', enabled: true },
  { id: 'v19', columnLetter: 'S', label: 'Tipo Ingreso', sourceType: 'conditional', value: 'tipoIngreso', transformation: 'none', enabled: true },
  { id: 'v20', columnLetter: 'T', label: 'Número Anexo', sourceType: 'conditional', value: 'numeroAnexo', transformation: 'none', enabled: true },
];

// Alias for backward compatibility
export const EXACT_SCRIPT_CONFIG = VENTAS_CONFIG;

// --- COMPRAS CONFIGURATION ---
// Based on F-07 Manual Section V (Detalle de Compras)
// Columns A to U
export const COMPRAS_CONFIG: FieldConfiguration = [
  { id: 'c1', columnLetter: 'A', label: 'Fecha Emisión', sourceType: 'json', value: 'identificacion.fecEmi', transformation: 'date_ddmmyyyy', enabled: true },
  { id: 'c2', columnLetter: 'B', label: 'Clase Doc', sourceType: 'static', value: '4', transformation: 'none', enabled: true },
  { id: 'c3', columnLetter: 'C', label: 'Tipo Doc', sourceType: 'json', value: 'identificacion.tipoDte', transformation: 'none', enabled: true },
  { id: 'c4', columnLetter: 'D', label: 'Num. Resolución/Gen', sourceType: 'json', value: 'identificacion.codigoGeneracion', transformation: 'remove_hyphens', enabled: true }, // For DTE usually generation code
  { id: 'c5', columnLetter: 'E', label: 'NRC Proveedor', sourceType: 'json', value: 'emisor.nrc', transformation: 'none', enabled: true },
  { id: 'c6', columnLetter: 'F', label: 'Nombre Proveedor', sourceType: 'json', value: 'emisor.nombre', transformation: 'none', enabled: true },
  { id: 'c7', columnLetter: 'G', label: 'Comp. Int. Exentas', sourceType: 'json', value: 'resumen.totalExenta', transformation: 'currency', enabled: true },
  { id: 'c8', columnLetter: 'H', label: 'Internaciones Exentas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c9', columnLetter: 'I', label: 'Importaciones Exentas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c10', columnLetter: 'J', label: 'Comp. Int. Gravadas', sourceType: 'json', value: 'resumen.totalGravada', transformation: 'currency', enabled: true },
  { id: 'c11', columnLetter: 'K', label: 'Internaciones Gravadas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c12', columnLetter: 'L', label: 'Importaciones Gravadas', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c13', columnLetter: 'M', label: 'Imp. Grav. Servicios', sourceType: 'static', value: '0.00', transformation: 'none', enabled: true },
  { id: 'c14', columnLetter: 'N', label: 'Crédito Fiscal (IVA)', sourceType: 'json', value: 'resumen.tributos', transformation: 'first_element_currency', enabled: true },
  { id: 'c15', columnLetter: 'O', label: 'Total Compras', sourceType: 'json', value: 'resumen.montoTotalOperacion', transformation: 'currency', enabled: true },
  { id: 'c16', columnLetter: 'P', label: 'DUI Proveedor', sourceType: 'json', value: 'emisor.numDocumento', transformation: 'none', enabled: true },
  { id: 'c17', columnLetter: 'Q', label: 'Tipo Operación', sourceType: 'conditional', value: 'tipoOperacionCompras', transformation: 'none', enabled: true },
  { id: 'c18', columnLetter: 'R', label: 'Clasificación', sourceType: 'conditional', value: 'clasificacionCompra', transformation: 'none', enabled: true }, // 1: Costo, 2: Gasto
  { id: 'c19', columnLetter: 'S', label: 'Sector', sourceType: 'conditional', value: 'sectorCompra', transformation: 'none', enabled: true }, // 1: Industria...
  { id: 'c20', columnLetter: 'T', label: 'Tipo Costo', sourceType: 'conditional', value: 'tipoCostoCompra', transformation: 'none', enabled: true },
  { id: 'c21', columnLetter: 'U', label: 'Número Anexo', sourceType: 'conditional', value: 'numeroAnexoCompras', transformation: 'none', enabled: true }, // Anexo 3 for Compras
];

// Helper to get nested property safely
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
};

// Simple helper to sanitize text fields for CSV: remove commas and semicolons
const sanitizeText = (value: string): string => {
  // Reemplaza comas y punto y comas por espacio y colapsa espacios múltiples
  return value.replace(/[;,]/g, ' ').replace(/\s+/g, ' ').trim();
};

// Helper to get conditional value based on DTE type and content
const getConditionalValue = (data: DTEData, field: string, tipoDte?: string): any => {
  const totalExenta = parseFloat(String(data.resumen?.totalExenta || '0'));
  const totalNoSujeta = parseFloat(String(data.resumen?.totalNoSuj || '0'));
  const totalGravada = parseFloat(String(data.resumen?.totalGravada || '0'));
  
  switch (field) {
    case 'tipoOperacion':
      // Columna R: Tipo Operación
      // 1=Operación gravada, 2=Operación exenta, 3=Operación no sujeta
      if (totalGravada > 0) return '1';
      if (totalExenta > 0) return '2';
      if (totalNoSujeta > 0) return '3';
      return '1'; // Default a gravada
      
    case 'tipoIngreso':
      // Columna S: Tipo Ingreso
      // 1=Exportación, 2=Ordinario, 3=Extraordinario, 4=Financieros, 5=Otros
      if (tipoDte === '11') return '1'; // Factura de exportación
      if (tipoDte === '14') return '5'; // Sujeto excluido -> Otros
      return '2'; // Default a ordinario
      
    case 'numeroAnexo':
      // Columna T: Número Anexo
      // 1=Exportaciones y Operaciones Exentas, 3=Compras, etc.
      if (tipoDte === '11' || totalExenta > 0 || totalNoSujeta > 0) return '1';
      return '3'; // Default a anexo 3 para operaciones gravadas
      
    case 'tipoOperacionCompras':
      // Columna Q: Tipo Operación en compras
      // 1=Operación gravada, 2=Operación exenta, 3=Operación no sujeta
      if (totalGravada > 0) return '1';
      if (totalExenta > 0) return '2';
      if (totalNoSujeta > 0) return '3';
      return '1'; // Default a gravada
      
    case 'clasificacionCompra':
      // Columna R: Clasificación (1=Costo, 2=Gasto)
      // Lógica: Si es factura de compra (01, 03, 08) y tiene items de inventario -> Costo
      // Si es factura de servicios -> Gasto
      // Por ahora, default a Costo para compras locales
      if (tipoDte === '01' || tipoDte === '03' || tipoDte === '08') return '1'; // Costo
      if (tipoDte === '02' || tipoDte === '04') return '2'; // Gasto (servicios)
      return '1'; // Default a Costo
      
    case 'sectorCompra':
      // Columna S: Sector (1=Industria, 2=Comercio, 3=Servicios, 4=Agropecuario, 5=Otros)
      // Por ahora, default a Industria
      return '1';
      
    case 'tipoCostoCompra':
      // Columna T: Tipo Costo (1=Inicial, 2=Desarrollo, 3=Terminados, 4=Otros)
      // Por ahora, default a Otros
      return '4';
      
    case 'numeroAnexoCompras':
      // Columna U: Número Anexo para compras
      // 1=Exportaciones y Operaciones Exentas, 3=Compras locales
      if (tipoDte === '11' || totalExenta > 0 || totalNoSujeta > 0) return '1';
      return '3'; // Default a anexo 3 para compras gravadas
      
    default:
      return '';
  }
};

export const extractValue = (data: DTEData, field: any, tipoDte?: string): string => {
  let rawValue: any = '';

  if (field.sourceType === 'static') {
    rawValue = field.value;
  } else if (field.sourceType === 'conditional') {
    // Manejar campos condicionales según la lógica del DTE
    rawValue = getConditionalValue(data, field.value, tipoDte);
  } else {
    rawValue = getNestedValue(data, field.value);
  }

  // Transformations
  if (rawValue === undefined || rawValue === null) rawValue = '';

  switch (field.transformation) {

    case 'date_ddmmyyyy':
      // Expects YYYY-MM-DD
      if (typeof rawValue === 'string' && rawValue.includes('-')) {
        const parts = rawValue.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return rawValue;
    
    case 'remove_hyphens':
      return String(rawValue).replace(/-/g, '');
    
    case 'currency':
      const num = parseFloat(rawValue);
      const finalNum = isNaN(num) ? 0 : num;
      // En CSV los montos siempre deben ir positivos; el tipo de documento indica la operación
      return Math.abs(finalNum).toFixed(2);

    case 'first_element_currency':
      // Special case for tributos array [0].valor
      if (Array.isArray(rawValue) && rawValue.length > 0) {
         const val = parseFloat(rawValue[0].valor);
         const finalVal = isNaN(val) ? 0 : val;
         // En CSV los montos siempre deben ir positivos; el tipo de documento indica la operación
         return Math.abs(finalVal).toFixed(2);
      }
      return '0.00';

    default:
      // Para valores de texto sin transformación específica, limpiamos caracteres
      // que puedan romper el CSV (comas y punto y comas).
      return sanitizeText(String(rawValue));
  }
};

export const generateHeaderRow = (config: FieldConfiguration): string => {
  return config.map(c => c.enabled ? getHeaderKey(c) : '').join(';') + '\n';
};

const getHeaderKey = (c: any) => {
   if(c.sourceType === 'static') return c.value || '';
   const parts = c.value.split('.');
   return parts[parts.length - 1];
}