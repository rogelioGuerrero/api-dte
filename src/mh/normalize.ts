import type { DTEJSON } from '../dte/generator';

const onlyDigits = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : null;
};

 const normalizeTwoDigitCode = (value: string | null | undefined): string | null => {
   const digits = onlyDigits(value);
   if (!digits) return null;
   return digits.padStart(2, '0').slice(-2);
 };

const trimOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
};

const roundTo = (value: number, decimals: number): number => {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(decimals));
};


export const normalizeDTE = (dte: DTEJSON): DTEJSON => {
  const codigosValidos015 = ['20', 'D1', 'C8', 'J1', 'J2', 'J3'];
  const tipoDte = (dte.identificacion?.tipoDte || '').trim();
  const versionIdentificacion = dte.identificacion?.version
    ?? (tipoDte === '03' ? 3 : tipoDte === '11' ? 1 : 1);

  const normalized: DTEJSON = {
    identificacion: {
      version: versionIdentificacion,
      ambiente: dte.identificacion?.ambiente === '01' ? '01' : '00',
      tipoDte: tipoDte || (dte.identificacion?.tipoDte as any),
      numeroControl: (dte.identificacion?.numeroControl || '').trim(),
      codigoGeneracion: (dte.identificacion?.codigoGeneracion || '').trim(),
      tipoModelo: dte.identificacion?.tipoModelo ?? 1,
      tipoOperacion: dte.identificacion?.tipoOperacion ?? 1,
      tipoContingencia: dte.identificacion?.tipoOperacion === 2 ? (dte.identificacion?.tipoContingencia ?? null) : null,
      motivoContin:
        dte.identificacion?.tipoContingencia === 5 ? (trimOrNull(dte.identificacion?.motivoContin) as any) : null,
      fecEmi: (dte.identificacion?.fecEmi || '').trim(),
      horEmi: (dte.identificacion?.horEmi || '').trim(),
      tipoMoneda: 'USD',
    },
    documentoRelacionado: (dte as any).documentoRelacionado ?? null,
    emisor: {
      nit: onlyDigits((dte as any).emisor?.nit) || '',
      nrc: onlyDigits((dte as any).emisor?.nrc) || '',
      nombre: (dte as any).emisor?.nombre ? String((dte as any).emisor.nombre).trim() : '',
      codActividad: (onlyDigits((dte as any).emisor?.codActividad) || String((dte as any).emisor?.codActividad || '')).trim(),
      descActividad: (dte as any).emisor?.descActividad ? String((dte as any).emisor.descActividad).trim() : '',
      nombreComercial: trimOrNull((dte as any).emisor?.nombreComercial) as any,
      tipoEstablecimiento: (dte as any).emisor?.tipoEstablecimiento ?? null,
      codEstable: trimOrNull((dte as any).emisor?.codEstable) as any,
      codPuntoVenta: trimOrNull((dte as any).emisor?.codPuntoVenta) as any,
      codEstableMH: ((dte as any).emisor?.codEstableMH ?? 'M001')?.toString().trim().toUpperCase().padEnd(4, '0').slice(0, 4),
      codPuntoVentaMH: ((dte as any).emisor?.codPuntoVentaMH ?? 'P001')?.toString().trim().toUpperCase().padEnd(4, '0').slice(0, 4),
      direccion: {
        departamento: normalizeTwoDigitCode((dte as any).emisor?.direccion?.departamento) as any,
        municipio: normalizeTwoDigitCode((dte as any).emisor?.direccion?.municipio) as any,
        complemento: trimOrNull((dte as any).emisor?.direccion?.complemento) as any,
      },
      telefono: (dte as any).emisor?.telefono ? String((dte as any).emisor.telefono).trim() : '',
      correo: (dte as any).emisor?.correo ? String((dte as any).emisor.correo).trim() : '',
    } as any,
    receptor: {
      ...(dte as any).receptor,
      tipoDocumento: (trimOrNull((dte as any).receptor?.tipoDocumento) as any) ?? null,
      numDocumento: onlyDigits((dte as any).receptor?.numDocumento),
      nrc: onlyDigits((dte as any).receptor?.nrc),
      nombre: (dte as any).receptor?.nombre ? String((dte as any).receptor.nombre).trim() : '',
      codActividad: trimOrNull((dte as any).receptor?.codActividad) as any,
      descActividad: trimOrNull((dte as any).receptor?.descActividad) as any,
      correo: trimOrNull((dte as any).receptor?.correo) as any,
      telefono: trimOrNull((dte as any).receptor?.telefono) as any,
      direccion: (dte as any).receptor?.direccion
        ? {
            departamento: normalizeTwoDigitCode((dte as any).receptor.direccion.departamento) as any,
            municipio: normalizeTwoDigitCode((dte as any).receptor.direccion.municipio) as any,
            complemento: trimOrNull((dte as any).receptor.direccion.complemento) as any,
          }
        : null,
    } as any,
    otrosDocumentos: (dte as any).otrosDocumentos ?? null,
    ventaTercero: (dte as any).ventaTercero ?? null,
    cuerpoDocumento: (dte.cuerpoDocumento || []).map((i: any) => {
      const ventaGravada = roundTo(i.ventaGravada ?? 0, 8);
      const ivaCalculado = tipoDte === '01' ? roundTo(ventaGravada * 0.13, 2) : roundTo(i.ivaItem ?? 0, 2);
      return {
        numItem: i.numItem,
        tipoItem: i.tipoItem,
        numeroDocumento: trimOrNull(i.numeroDocumento) as any,
        codigo: i.codigo ? String(i.codigo).trim() : null,
        codTributo: trimOrNull(i.codTributo) as any,
        descripcion: String(i.descripcion || '').trim(),
        cantidad: roundTo(i.cantidad, 8),
        uniMedida: i.uniMedida,
        precioUni: roundTo(i.precioUni, 8),
        montoDescu: roundTo(i.montoDescu, 8),
        ventaNoSuj: roundTo(i.ventaNoSuj, 8),
        ventaExenta: roundTo(i.ventaExenta, 8),
        ventaGravada,
        tributos: tipoDte === '01' ? null : (ventaGravada > 0 ? ['20'] : null),
        psv: roundTo(i.psv ?? 0, 2),
        noGravado: roundTo(i.noGravado ?? 0, 2),
        ivaItem: ivaCalculado,
      };
    }),
    resumen: (() => {
      const items = (dte.cuerpoDocumento || []).map((i: any) => {
        const ventaGravada = roundTo(i.ventaGravada ?? 0, 8);
        const ivaCalculado = tipoDte === '01' ? roundTo(ventaGravada * 0.13, 2) : roundTo(i.ivaItem ?? 0, 2);
        return { ventaGravada, ventaNoSuj: roundTo(i.ventaNoSuj ?? 0, 8), ventaExenta: roundTo(i.ventaExenta ?? 0, 8), ivaItem: ivaCalculado };
      });
      const totalGravada = roundTo(items.reduce((a, b) => a + b.ventaGravada, 0), 2);
      const totalNoSuj = roundTo(items.reduce((a, b) => a + b.ventaNoSuj, 0), 2);
      const totalExenta = roundTo(items.reduce((a, b) => a + b.ventaExenta, 0), 2);
      const totalIva = roundTo(items.reduce((a, b) => a + b.ivaItem, 0), 2);
      const subTotalVentas = roundTo(totalNoSuj + totalExenta + totalGravada, 2);
      const subTotal = subTotalVentas;
      const totalNoGravado = roundTo((dte as any).resumen?.totalNoGravado ?? 0, 2);
      const montoTotalOperacion = tipoDte === '01'
        ? roundTo(subTotal + totalNoGravado, 2)
        : roundTo(subTotal + totalIva + totalNoGravado, 2);
      const totalPagar = montoTotalOperacion;

      return {
        totalNoSuj,
        totalExenta,
        totalGravada,
        subTotalVentas,
        descuNoSuj: roundTo((dte as any).resumen?.descuNoSuj ?? 0, 2),
        descuExenta: roundTo((dte as any).resumen?.descuExenta ?? 0, 2),
        descuGravada: roundTo((dte as any).resumen?.descuGravada ?? 0, 2),
        porcentajeDescuento: roundTo((dte as any).resumen?.porcentajeDescuento ?? 0, 2),
        totalDescu: roundTo((dte as any).resumen?.totalDescu ?? 0, 2),
        totalIva,
        tributos:
          tipoDte === '01'
            ? null
            : (totalIva > 0
                ? [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: totalIva }]
                : null),
        subTotal,
        // MH requiere ivaRete1
        ivaRete1: roundTo(((dte as any).resumen?.ivaRete1 ?? 0) as number, 2),
        reteRenta: roundTo(((dte as any).resumen?.reteRenta ?? 0) as number, 2),
        montoTotalOperacion,
        totalNoGravado: roundTo((dte as any).resumen?.totalNoGravado ?? 0, 2),
        totalPagar,
        totalLetras: (dte as any).resumen?.totalLetras ? String((dte as any).resumen.totalLetras).trim() : '',
        saldoFavor: roundTo((dte as any).resumen?.saldoFavor ?? 0, 2),
        condicionOperacion: (dte as any).resumen?.condicionOperacion ?? 1,
        pagos: (dte as any).resumen?.pagos ?? null,
        numPagoElectronico: (dte as any).resumen?.numPagoElectronico ?? null,
      } as any;
    })(),
    extension: null,
    apendice: null,
  };

  return normalized;
};
