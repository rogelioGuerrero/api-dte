import type { DTEJSON } from '../dte/generator';

const onlyDigits = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : null;
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
  return {
    ...dte,
    identificacion: {
      ...dte.identificacion,
      ambiente: dte.identificacion?.ambiente === '01' ? '01' : '00',
      tipoMoneda: 'USD',
      tipoContingencia: dte.identificacion?.tipoOperacion === 2 ? dte.identificacion?.tipoContingencia : null,
      motivoContin: dte.identificacion?.tipoContingencia === 5 ? (trimOrNull(dte.identificacion?.motivoContin) as any) : null,
    },
    emisor: {
      ...dte.emisor,
      nit: (onlyDigits(dte.emisor?.nit) || ''),
      nrc: (onlyDigits(dte.emisor?.nrc) || ''),
      nombre: dte.emisor?.nombre ? dte.emisor.nombre.trim() : '',
      codActividad: (onlyDigits(dte.emisor?.codActividad) || dte.emisor?.codActividad || '').trim(),
      descActividad: dte.emisor?.descActividad ? dte.emisor.descActividad.trim() : '',
      nombreComercial: trimOrNull(dte.emisor?.nombreComercial) as any,
      tipoEstablecimiento: dte.emisor?.tipoEstablecimiento ? dte.emisor.tipoEstablecimiento.trim() : '',
      codEstable: trimOrNull(dte.emisor?.codEstable) as any,
      codPuntoVenta: trimOrNull(dte.emisor?.codPuntoVenta) as any,
      telefono: dte.emisor?.telefono ? dte.emisor.telefono.trim() : '',
      correo: dte.emisor?.correo ? dte.emisor.correo.trim() : '',
      codEstableMH: trimOrNull(dte.emisor?.codEstableMH) as any,
      codPuntoVentaMH: trimOrNull(dte.emisor?.codPuntoVentaMH) as any,
    },
    receptor: {
      ...dte.receptor,
      tipoDocumento: (trimOrNull(dte.receptor?.tipoDocumento) as any) ?? null,
      numDocumento: onlyDigits(dte.receptor?.numDocumento),
      nrc: onlyDigits(dte.receptor?.nrc),
      nombre: dte.receptor?.nombre ? dte.receptor.nombre.trim() : '',
      codActividad: trimOrNull(dte.receptor?.codActividad) as any,
      descActividad: trimOrNull(dte.receptor?.descActividad) as any,
      correo: (trimOrNull(dte.receptor?.correo) || DEFAULT_RECEPTOR_EMAIL) as any,
      telefono: trimOrNull(dte.receptor?.telefono) as any,
      direccion: dte.receptor?.direccion
        ? {
            departamento: trimOrNull(dte.receptor.direccion.departamento) as any,
            municipio: trimOrNull(dte.receptor.direccion.municipio) as any,
            complemento: trimOrNull(dte.receptor.direccion.complemento) as any,
          }
        : null,
    },
    cuerpoDocumento: (dte.cuerpoDocumento || []).map((i) => ({
      ...i,
      codigo: i.codigo ? i.codigo.trim() : null,
      descripcion: i.descripcion.trim(),
      cantidad: roundTo(i.cantidad, 8),
      precioUni: roundTo(i.precioUni, 8),
      montoDescu: roundTo(i.montoDescu, 8),
      ventaNoSuj: roundTo(i.ventaNoSuj, 8),
      ventaExenta: roundTo(i.ventaExenta, 8),
      ventaGravada: roundTo(i.ventaGravada, 8),
      tributos:
        i.tributos === null
          ? null
          : (i.tributos ?? []).map((t) => String(t).trim()).filter(Boolean) as any,
      numeroDocumento: trimOrNull(i.numeroDocumento) as any,
      codTributo: trimOrNull(i.codTributo) as any,
      psv: roundTo(i.psv ?? 0, 2),
      noGravado: roundTo(i.noGravado ?? 0, 2),
      ivaItem: roundTo(i.ivaItem ?? 0, 2),
    })),
    resumen: {
      ...dte.resumen,
      totalNoSuj: roundTo(dte.resumen?.totalNoSuj ?? 0, 2),
      totalExenta: roundTo(dte.resumen?.totalExenta ?? 0, 2),
      totalGravada: roundTo(dte.resumen?.totalGravada ?? 0, 2),
      subTotalVentas: roundTo(dte.resumen?.subTotalVentas ?? 0, 2),
      descuNoSuj: roundTo(dte.resumen?.descuNoSuj ?? 0, 2),
      descuExenta: roundTo(dte.resumen?.descuExenta ?? 0, 2),
      descuGravada: roundTo(dte.resumen?.descuGravada ?? 0, 2),
      porcentajeDescuento: roundTo(dte.resumen?.porcentajeDescuento ?? 0, 2),
      totalDescu: roundTo(dte.resumen?.totalDescu ?? 0, 2),
      totalIva: roundTo(dte.resumen?.totalIva ?? 0, 2),
      subTotal: roundTo(dte.resumen?.subTotal ?? 0, 2),
      ivaRete1: roundTo(dte.resumen?.ivaRete1 ?? 0, 2),
      reteRenta: roundTo(dte.resumen?.reteRenta ?? 0, 2),
      montoTotalOperacion: roundTo(dte.resumen?.montoTotalOperacion ?? 0, 2),
      totalNoGravado: roundTo(dte.resumen?.totalNoGravado ?? 0, 2),
      totalPagar: roundTo(dte.resumen?.totalPagar ?? 0, 2),
      saldoFavor: roundTo(dte.resumen?.saldoFavor ?? 0, 2),
      tributos:
        dte.resumen?.tributos === null
          ? null
          : (dte.resumen?.tributos ?? []).map((t) => ({
              ...t,
              valor: roundTo(t.valor, 2),
            })),
      totalLetras: dte.resumen?.totalLetras ? dte.resumen.totalLetras.trim() : '',
    },
    extension: dte.extension ?? null,
    apendice: dte.apendice ?? null,
  };
};
