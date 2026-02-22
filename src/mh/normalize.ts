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

const DEFAULT_RECEPTOR_EMAIL = 'consumidor.final@example.com';

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
        distrito: trimOrNull((dte as any).emisor?.direccion?.distrito) as any,
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
      correo: (trimOrNull((dte as any).receptor?.correo) || DEFAULT_RECEPTOR_EMAIL) as any,
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
    cuerpoDocumento: (dte.cuerpoDocumento || []).map((i: any) => ({
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
      ventaGravada: roundTo(i.ventaGravada, 8),
      tributos:
        i.tributos === null
          ? null
          : (i.tributos ?? [])
              .map((t: any) => String(t).trim())
              .filter(Boolean)
              .map((codigo: string) => (codigosValidos015.includes(codigo) ? codigo : '20')) as any,
      psv: roundTo(i.psv ?? 0, 2),
      noGravado: roundTo(i.noGravado ?? 0, 2),
      ivaItem: roundTo(i.ivaItem ?? 0, 2),
    })),
    resumen: {
      totalNoSuj: roundTo((dte as any).resumen?.totalNoSuj ?? 0, 2),
      totalExenta: roundTo((dte as any).resumen?.totalExenta ?? 0, 2),
      totalGravada: roundTo((dte as any).resumen?.totalGravada ?? 0, 2),
      subTotalVentas: roundTo((dte as any).resumen?.subTotalVentas ?? 0, 2),
      descuNoSuj: roundTo((dte as any).resumen?.descuNoSuj ?? 0, 2),
      descuExenta: roundTo((dte as any).resumen?.descuExenta ?? 0, 2),
      descuGravada: roundTo((dte as any).resumen?.descuGravada ?? 0, 2),
      porcentajeDescuento: roundTo((dte as any).resumen?.porcentajeDescuento ?? 0, 2),
      totalDescu: roundTo((dte as any).resumen?.totalDescu ?? 0, 2),
      totalIva: roundTo((dte as any).resumen?.totalIva ?? 0, 2),
      tributos:
        (dte as any).resumen?.tributos === null
          ? null
          : ((dte as any).resumen?.tributos ?? []).map((t: any) => ({
              codigo: codigosValidos015.includes(String(t.codigo).trim()) ? String(t.codigo).trim() : '20',
              descripcion: String(t.descripcion || '').trim(),
              valor: roundTo(t.valor ?? 0, 2),
            })),
      subTotal: roundTo((dte as any).resumen?.subTotal ?? 0, 2),
      ivaRete: roundTo(((dte as any).resumen?.ivaRete ?? (dte as any).resumen?.ivaRete1 ?? 0) as number, 2),
      montoTotalOperacion: roundTo((dte as any).resumen?.montoTotalOperacion ?? 0, 2),
      totalNoGravado: roundTo((dte as any).resumen?.totalNoGravado ?? 0, 2),
      totalPagar: roundTo((dte as any).resumen?.totalPagar ?? 0, 2),
      totalLetras: (dte as any).resumen?.totalLetras ? String((dte as any).resumen.totalLetras).trim() : '',
      saldoFavor: roundTo((dte as any).resumen?.saldoFavor ?? 0, 2),
      condicionOperacion: (dte as any).resumen?.condicionOperacion ?? 1,
      pagos: (dte as any).resumen?.pagos ?? null,
      numPagoElectronico: (dte as any).resumen?.numPagoElectronico ?? null,
      observaciones: (dte as any).resumen?.observaciones ?? null,
    } as any,
    // NO incluir extension / apendice aquí para evitar 096
    apendice: null,
  };

  return normalized;
};
