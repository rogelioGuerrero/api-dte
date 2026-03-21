import type { DTEJSON } from '../dte/generator';
import { resolveDteContract } from './contracts';

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
  const tipoDte = (dte.identificacion?.tipoDte || '').trim();
  const contract = resolveDteContract(tipoDte);
  const versionIdentificacion = tipoDte === '03'
    ? 3
    : tipoDte === '11'
      ? 1
      : (dte.identificacion?.version ?? 1);

  const normalizedItems = (dte.cuerpoDocumento || []).map((i: any) => {
    const cantidad = roundTo(i.cantidad, 8);
    let precioUni = roundTo(i.precioUni, 8);
    const ventaGravadaInput = roundTo(i.ventaGravada ?? 0, 8);
    const gross = roundTo(cantidad * precioUni, 8);

    let ventaGravada = ventaGravadaInput > 0 ? roundTo(ventaGravadaInput, 2) : roundTo(gross, 2);
    let ivaCalculado = roundTo(i.ivaItem ?? 0, 2);

    if (tipoDte === '01' && gross > 0) {
      // Para factura consumidor final: montos llevan IVA incluido.
      // MH espera montos con IVA; IVA se envÃ­a informativo, no se suma al total.
      ventaGravada = roundTo(gross, 2);
      const base = Math.round((gross / 1.13) * 100) / 100;
      ivaCalculado = roundTo(gross - base, 2);
      precioUni = roundTo(gross / cantidad, 8); // precio unitario con IVA
    }

    return {
      numItem: i.numItem,
      tipoItem: i.tipoItem,
      numeroDocumento: trimOrNull(i.numeroDocumento) as any,
      codigo: i.codigo ? String(i.codigo).trim() : null,
      codTributo: tipoDte === '03'
        ? (i.tipoItem === 4 ? trimOrNull(i.codTributo) as any : null)
        : trimOrNull(i.codTributo) as any,
      descripcion: String(i.descripcion || '').trim(),
      cantidad,
      uniMedida: i.uniMedida,
      precioUni,
      montoDescu: roundTo(i.montoDescu, 8),
      ventaNoSuj: roundTo(i.ventaNoSuj, 8),
      ventaExenta: roundTo(i.ventaExenta, 8),
      ventaGravada,
      tributos: tipoDte === '01' ? null : (ventaGravada > 0 ? ['20'] : null),
      psv: roundTo(i.psv ?? 0, 2),
      noGravado: roundTo(i.noGravado ?? 0, 2),
      ...(tipoDte === '03' ? {} : { ivaItem: ivaCalculado }),
    };
  });

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
      codEstable: null,
      codPuntoVenta: null,
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
    receptor: (() => {
      const baseReceptor = {
        ...(dte as any).receptor,
        ...(tipoDte === '03'
          ? {
              tipoDocumento: null,
              numDocumento: null,
            }
          : {
              tipoDocumento: (trimOrNull((dte as any).receptor?.tipoDocumento) as any) ?? null,
              numDocumento: onlyDigits((dte as any).receptor?.numDocumento),
            }),
        nit: onlyDigits((dte as any).receptor?.nit),
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
      } as any;

      if (!contract?.normalize) {
        return baseReceptor;
      }

      const contractNormalization = contract.normalize(dte, {
        onlyDigits,
        normalizeTwoDigitCode,
        trimOrNull,
        roundTo,
      });

      return contractNormalization.receptor ?? baseReceptor;
    })(),
    otrosDocumentos: (dte as any).otrosDocumentos ?? null,
    ventaTercero: (dte as any).ventaTercero ?? null,
    cuerpoDocumento: normalizedItems,
    resumen: (() => {
      const ivaCodigo = '20';
      const items = normalizedItems;
      const totalGravada = roundTo(items.reduce((a, b) => a + b.ventaGravada, 0), 2);
      const totalNoSuj = roundTo(items.reduce((a, b) => a + b.ventaNoSuj, 0), 2);
      const totalExenta = roundTo(items.reduce((a, b) => a + b.ventaExenta, 0), 2);
      const resumenIvaTributo = Array.isArray((dte as any).resumen?.tributos)
        ? (dte as any).resumen.tributos.find((t: any) => t?.codigo === '20')
        : null;
      const totalIva = tipoDte === '03'
        ? roundTo(((dte as any).resumen?.totalIva ?? resumenIvaTributo?.valor ?? roundTo(totalGravada * 0.13, 2)) as number, 2)
        : roundTo(items.reduce((a, b) => a + (b.ivaItem ?? 0), 0), 2);
      // En tipo 01 (Factura consumidor final) montos con IVA incluido; totalIva es informativo.
      const subTotalVentas = roundTo(totalNoSuj + totalExenta + totalGravada, 2);
      const subTotal = subTotalVentas;
      const totalNoGravado = roundTo((dte as any).resumen?.totalNoGravado ?? 0, 2);
      const totalDescu = roundTo((dte as any).resumen?.totalDescu ?? 0, 2);
      const ivaPerci1 = roundTo((dte as any).resumen?.ivaPerci1 ?? 0, 2);
      const ivaRete1 = roundTo(((dte as any).resumen?.ivaRete1 ?? 0) as number, 2);
      const reteRenta = roundTo(((dte as any).resumen?.reteRenta ?? 0) as number, 2);
      const saldoFavor = roundTo((dte as any).resumen?.saldoFavor ?? 0, 2);
      const montoTotalOperacion = tipoDte === '01'
        ? roundTo(subTotal - totalDescu + totalNoGravado, 2)
        : roundTo(subTotal - totalDescu + totalNoGravado + totalIva + ivaPerci1 - ivaRete1 - reteRenta + saldoFavor, 2);
      const totalPagar = roundTo(montoTotalOperacion, 2);

      return {
        totalNoSuj,
        totalExenta,
        totalGravada,
        subTotalVentas,
        descuNoSuj: roundTo((dte as any).resumen?.descuNoSuj ?? 0, 2),
        descuExenta: roundTo((dte as any).resumen?.descuExenta ?? 0, 2),
        descuGravada: roundTo((dte as any).resumen?.descuGravada ?? 0, 2),
        porcentajeDescuento: roundTo((dte as any).resumen?.porcentajeDescuento ?? 0, 2),
        totalDescu,
        ivaPerci1,
        tributos:
          tipoDte === '01'
            ? null
            : totalIva > 0
              ? [{ codigo: ivaCodigo, descripcion: 'IVA 13%', valor: totalIva }]
              : null,
        subTotal,
        ivaRete1,
        reteRenta,
        montoTotalOperacion,
        totalNoGravado,
        totalPagar,
        totalLetras: (() => {
          const raw = (dte as any).resumen?.totalLetras ? String((dte as any).resumen.totalLetras).trim() : '';
          if (!raw) return '';
          return raw.endsWith('USD') ? raw : `${raw} USD`;
        })(),
        saldoFavor,
        condicionOperacion: (dte as any).resumen?.condicionOperacion ?? 1,
        pagos: (dte as any).resumen?.pagos ?? null,
        numPagoElectronico: (dte as any).resumen?.numPagoElectronico ?? null,
      } as any;
    })(),
    extension: (() => {
      const extension = (dte as any).extension || {};

      return {
        nombEntrega: trimOrNull(extension.nombEntrega) as any,
        docuEntrega: trimOrNull(extension.docuEntrega) as any,
        nombRecibe: trimOrNull(extension.nombRecibe) as any,
        docuRecibe: trimOrNull(extension.docuRecibe) as any,
        observaciones: trimOrNull(extension.observaciones) as any,
        placaVehiculo: trimOrNull(extension.placaVehiculo) as any,
      };
    })(),
    apendice: null,
  };

  return normalized;
};

