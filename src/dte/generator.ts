// Exportar tipos para compatibilidad
export interface ClientData {
  nit: string;
  name?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  departamento?: string;
  municipio?: string;
  nrc?: string;
  actividadEconomica?: string;
  descActividad?: string;
}

export interface EmisorData {
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial?: string;
  codEstableMH?: string;
  codPuntoVentaMH?: string;
  actividadEconomica: string;
  descActividad?: string;
  tipoEstablecimiento?: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
}

export interface ItemFactura {
  numItem: number;
  tipoItem: number; // 1=Bienes, 2=Servicios
  cantidad: number;
  codigo: string | null;
  uniMedida: number;
  descripcion: string;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null;
  numeroDocumento?: string | null;
  codTributo?: string | null;
  psv?: number;
  noGravado?: number;
  ivaItem?: number;
}

export interface DatosFactura {
  emisor: EmisorData;
  receptor: ClientData;
  items: ItemFactura[];
  tipoDocumento: string;
  tipoTransmision: number;
  formaPago: string;
  condicionOperacion: number;
  observaciones?: string;
}

export interface DTEJSON {
  identificacion: {
    version: number;
    ambiente: string;
    tipoDte: string;
    numeroControl: string;
    codigoGeneracion: string;
    tipoModelo: number;
    tipoOperacion: number;
    tipoContingencia: number | null;
    motivoContin: string | null;
    fecEmi: string;
    horEmi: string;
    tipoMoneda: string;
  };
  documentoRelacionado: null;
  emisor: {
    nit: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string | null;
    tipoEstablecimiento: string;
    codEstable: string | null;
    codPuntoVenta: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
    telefono: string;
    correo: string;
    codEstableMH: string | null;
    codPuntoVentaMH: string | null;
  };
  receptor: {
    tipoDocumento: string | null;
    numDocumento: string | null;
    nrc: string | null;
    nombre: string;
    codActividad: string | null;
    descActividad: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    } | null;
    telefono: string | null;
    correo: string;
  };
  otrosDocumentos: null;
  ventaTercero: null;
  cuerpoDocumento: ItemFactura[];
  resumen: {
    totalNoSuj: number;
    totalExenta: number;
    totalGravada: number;
    subTotalVentas: number;
    descuNoSuj: number;
    descuExenta: number;
    descuGravada: number;
    porcentajeDescuento: number;
    totalDescu: number;
    totalIva: number;
    tributos: Array<{
      codigo: string;
      descripcion: string;
      valor: number;
    }> | null;
    subTotal: number;
    ivaRete1: number;
    reteRenta: number;
    montoTotalOperacion: number;
    totalNoGravado: number;
    totalPagar: number;
    totalLetras: string;
    saldoFavor: number;
    condicionOperacion: number;
    pagos: Array<{
      codigo: string;
      montoPago: number;
      referencia: string | null;
      plazo: string | null;
      periodo: number | null;
    }> | null;
    numPagoElectronico: string | null;
  };
  extension: {
    nombEntrega: string | null;
    docuEntrega: string | null;
    nombRecibe: string | null;
    docuRecibe: string | null;
    observaciones: string | null;
    placaVehiculo: string | null;
  } | null;
  apendice: null;
}

// Generar UUID v4
export const generarUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

// Generar número de control según formato DTE
export const generarNumeroControl = (tipoDte: string, correlativo: number, codEstableMH: string | null, codPuntoVentaMH: string | null): string => {
  const tipoDoc = tipoDte.padStart(2, '0');
  const corr = correlativo.toString().padStart(15, '0');
  
  // Usar códigos MH si existen, sino fallback a valores por defecto
  const establecimiento = (codEstableMH || 'M001').padEnd(4, '0').slice(0, 4);
  const puntoVenta = (codPuntoVentaMH || 'P001').padEnd(4, '0').slice(0, 4);
  const segmentoMedio = `${establecimiento}${puntoVenta}`;
  
  return `DTE-${tipoDoc}-${segmentoMedio}-${corr}`;
};

// Redondeo según especificación AT (8 decimales para cantidades/precios)
export const redondear = (valor: number, decimales: number = 2): number => {
  const factor = Math.pow(10, decimales);
  // Primer paso: redondeo aritmético correcto (round half up)
  const rounded = Math.round((valor + Number.EPSILON) * factor) / factor;
  // Segundo paso: eliminar residuos de punto flotante (ej. 1.1000000000000001) asegurando la precisión fija
  return Number(rounded.toFixed(decimales));
};

// Convertir número a letras (simplificado)
export const numeroALetras = (num: number): string => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE'];
  
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  if (entero === 0) return `CERO DÓLARES CON ${centavos.toString().padStart(2, '0')}/100 USD`;
  
  let resultado = '';
  
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    resultado += miles === 1 ? 'MIL ' : `${unidades[miles]} MIL `;
  }
  
  const resto = entero % 1000;
  if (resto >= 100) {
    const centenas = Math.floor(resto / 100);
    if (centenas === 1 && resto % 100 === 0) {
      resultado += 'CIEN ';
    } else {
      const centenasTexto = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      resultado += centenasTexto[centenas] + ' ';
    }
  }
  
  const decenaUnidad = resto % 100;
  if (decenaUnidad > 0) {
    if (decenaUnidad < 10) {
      resultado += unidades[decenaUnidad];
    } else if (decenaUnidad < 16) {
      resultado += especiales[decenaUnidad - 10];
    } else if (decenaUnidad < 20) {
      resultado += 'DIECI' + unidades[decenaUnidad - 10].toLowerCase();
    } else {
      const d = Math.floor(decenaUnidad / 10);
      const u = decenaUnidad % 10;
      if (u === 0) {
        resultado += decenas[d];
      } else if (d === 2) {
        resultado += 'VEINTI' + unidades[u].toLowerCase();
      } else {
        resultado += decenas[d] + ' Y ' + unidades[u];
      }
    }
  }
  
  const moneda = entero === 1 ? 'DÓLAR' : 'DÓLARES';
  return `${resultado.trim()} ${moneda} CON ${centavos.toString().padStart(2, '0')}/100 USD`;
};

// Obtener fecha actual en formato ISO
export const obtenerFechaActual = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// Obtener hora actual en formato HH:mm:ss
export const obtenerHoraActual = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
};

// Convertir DTE a Contingencia (Modelo Diferido)
export const convertirAContingencia = (dte: DTEJSON, motivo: string = 'Falla en el servicio de Internet'): DTEJSON => {
  const cloned = JSON.parse(JSON.stringify(dte));
  
  cloned.identificacion.tipoModelo = 2; // Modelo Diferido
  cloned.identificacion.tipoOperacion = 2; // Transmisión por Contingencia
  cloned.identificacion.tipoContingencia = 2; // 2 = Falla en el servicio de Internet (por defecto)
  cloned.identificacion.motivoContin = motivo;
  
  // Actualizar fecha y hora a la actual (momento de la firma offline)
  cloned.identificacion.fecEmi = obtenerFechaActual();
  cloned.identificacion.horEmi = obtenerHoraActual();
  
  return cloned;
};
