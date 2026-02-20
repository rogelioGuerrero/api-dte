import { DTEData, ProcessedFile, FieldConfiguration, AppMode } from '../types/types';
import { extractValue, VENTAS_CONFIG } from '../exports/fieldMapping';
import { loadSettings } from './settings';

// Standard DTE Types for El Salvador
const VALID_DTE_TYPES = [
  '01', // Factura
  '03', // Comprobante de crédito fiscal
  '04', // Nota de remisión
  '05', // Nota de crédito
  '06', // Nota de débito
  '07', // Comprobante de retención
  '08', // Comprobante de liquidación
  '09', // Documento contable de liquidación
  '11', // Facturas de exportación
  '14', // Factura de sujeto excluido
  '15', // Comprobante de donación
];

export const processJsonContent = (
  fileName: string, 
  jsonContent: string, 
  config: FieldConfiguration = VENTAS_CONFIG,
  mode: AppMode | 'auto' = 'ventas'
): ProcessedFile => {
  const settings = loadSettings();
  // Simple unique ID generation
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  try {
    const data: DTEData = JSON.parse(jsonContent);

    // Validate essential fields to ensure it's a DTE
    if (!data.identificacion) {
      throw new Error("Estructura JSON inválida: Falta 'identificacion'");
    }

    // Validate DTE Type
    const tipoDte = data.identificacion.tipoDte;
    if (!tipoDte || !VALID_DTE_TYPES.includes(tipoDte)) {
      throw new Error(`Tipo de DTE no válido o desconocido: ${tipoDte || 'Indefinido'}`);
    }

    // Extract essential metadata for grouping/display (kept separate from CSV line generation for UI purposes)
    const rawDate = data.identificacion.fecEmi || '';
    const dateParts = rawDate.split('-');
    const yearMonth = dateParts.length === 3 ? `${dateParts[0]}-${dateParts[1]}` : 'Unknown';
    
    // Safety checks for display data
    const displayDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : rawDate;
    const displayControl = data.identificacion.numeroControl || 'N/A';
    
    // Función para normalizar NIT/DUI (solo quitar guiones y espacios, NO quitar ceros)
    // El cero inicial en DUI (ej: 02453099-6) es significativo
    const normalizeId = (id: string): string => {
      if (!id) return '';
      return id.replace(/[-\s]/g, '');
    };

    // Auto-detect mode if enabled in settings and mode is 'auto'
    let effectiveMode: AppMode = mode === 'auto' ? 'ventas' : mode;
    
    // Solo auto-detectar si el modo es 'auto' Y el usuario tiene habilitada la detección automática
    if (mode === 'auto' && settings.useAutoDetection && (settings.myNit || settings.myNrc)) {
      const emisorNit = normalizeId(data.emisor?.nit || '');
      const emisorNrc = normalizeId(data.emisor?.nrc || '');
      const receptorNit = normalizeId(data.receptor?.nit || '');
      const receptorNrc = normalizeId(data.receptor?.nrc || '');
      const myNitClean = normalizeId(settings.myNit);
      const myNrcClean = normalizeId(settings.myNrc);
      
      // Si yo soy el EMISOR → es una VENTA (yo vendo)
      const isMyCompanyEmitter = 
        (myNitClean && emisorNit === myNitClean) || 
        (myNrcClean && emisorNrc === myNrcClean);
      
      // Si yo soy el RECEPTOR → es una COMPRA (yo compro)
      const isMyCompanyReceiver = 
        (myNitClean && receptorNit === myNitClean) || 
        (myNrcClean && receptorNrc === myNrcClean);
      
      if (isMyCompanyEmitter) {
        effectiveMode = 'ventas';
      } else if (isMyCompanyReceiver) {
        effectiveMode = 'compras';
      }
      // Si no coincide ninguno, mantiene 'ventas' como fallback
    }

    // Determine Counterparty Name based on Mode
    // Ventas (Sales) -> We want to see the Receptor (Client)
    // Compras (Purchases) -> We want to see the Emisor (Provider)
    let displayCounterparty = 'Sin Nombre';
    let taxpayerInfo = { nombre: '', nit: '', nrc: '' };
    
    if (effectiveMode === 'compras') {
       displayCounterparty = data.emisor?.nombre || 'Sin Proveedor';
       // En Compras, el contribuyente (dueño del libro) es el Receptor
       if (data.receptor) {
         taxpayerInfo = {
           nombre: data.receptor.nombre,
           nit: data.receptor.nit || '',
           nrc: data.receptor.nrc
         };
       }
    } else {
       displayCounterparty = data.receptor?.nombre || 'Sin Cliente';
       // En Ventas, el contribuyente (dueño del libro) es el Emisor
       if (data.emisor) {
         taxpayerInfo = {
           nombre: data.emisor.nombre,
           nit: data.emisor.nit,
           nrc: data.emisor.nrc
         };
       }
    }

    // Valores para visualización en UI (con signo negativo para notas crédito)
    const displayTotal = (tipoDte === '05' ? -Math.abs(data.resumen?.montoTotalOperacion || 0) : (data.resumen?.montoTotalOperacion || 0)).toFixed(2);
    const displayNeto = (tipoDte === '05' ? -Math.abs(data.resumen?.subTotal || 0) : (data.resumen?.subTotal || 0)).toFixed(2);
    const displayIva = (tipoDte === '05' ? -Math.abs(data.resumen?.tributos && data.resumen.tributos.length > 0 
      ? data.resumen.tributos[0].valor 
      : 0) : (data.resumen?.tributos && data.resumen.tributos.length > 0 
      ? data.resumen.tributos[0].valor 
      : 0)).toFixed(2);
    const displayExentas = (tipoDte === '05' ? -Math.abs(data.resumen?.totalExenta || 0) : (data.resumen?.totalExenta || 0)).toFixed(2);

    // Dynamic CSV Line Generation
    const csvFields = config
      .filter(field => field.enabled)
      .map(field => extractValue(data, field, tipoDte));
    
    const linea = csvFields.join(';') + '\n';

    // Validar si está fuera del plazo (solo para compras)
    let isOutOfTime = false;
    if (effectiveMode === 'compras') {
      const fechaEmision = new Date(rawDate);
      const fechaActual = new Date();
      
      // Obtener año y mes de la emisión
      const añoEmision = fechaEmision.getFullYear();
      const mesEmision = fechaEmision.getMonth(); // 0-11
      
      // Obtener año y mes actual
      const añoActual = fechaActual.getFullYear();
      const mesActual = fechaActual.getMonth(); // 0-11
      
      // Calcular diferencia en meses
      let diferenciaMeses = (añoActual - añoEmision) * 12 + (mesActual - mesEmision);
      
      // Regla compras:
      // - Mes actual NO cuenta (diferenciaMeses === 0 => fuera de tiempo)
      // - Válidos: 1, 2 y 3 meses antes (inclusive)
      // - Fuera de tiempo: < 1 o > 3
      if (diferenciaMeses < 1 || diferenciaMeses > 3) {
        isOutOfTime = true;
      }
    }

    return {
      id: uniqueId,
      fileName,
      month: yearMonth,
      csvLine: linea,
      isValid: true, // El JSON ya está validado
      data: {
        date: displayDate,
        controlNumber: displayControl,
        total: displayTotal,
        receiver: displayCounterparty, // This property name remains 'receiver' but holds Counterparty name
        neto: displayNeto,
        iva: displayIva,
        exentas: displayExentas,
        tipoDTE: tipoDte, // Agregar tipo de DTE
        codigoGeneracion: data.identificacion?.codigoGeneracion || '', // Agregar código de generación
        selloRecibido: data.selloRecibido || '', // Agregar sello de recepción
      },
      taxpayer: taxpayerInfo,
      dteType: tipoDte,
      isOutOfTime, // Determinar según lógica de tiempo
      detectedMode: effectiveMode, // Store the detected mode (ventas or compras)
      originalDte: data, // Save full DTE for agent processing
    };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return {
      id: uniqueId,
      fileName,
      month: 'error',
      csvLine: '',
      isValid: false,
      errorMessage: msg,
      data: { date: '', controlNumber: '', total: '', receiver: '', neto: '', iva: '', exentas: '' }
    };
  }
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};