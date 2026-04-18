export const round8 = (value: number) => Math.round(value * 1e8) / 1e8;
export const round2 = (value: number) => Math.round(value * 1e2) / 1e2;
export const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

export type ItemTotals = {
  sumaGravada: number;
  sumaExenta: number;
  sumaNoSuj: number;
  sumaIvaItems: number;
};

export const readItemTotals = (items: any[]): ItemTotals => {
  let sumaGravada = 0;
  let sumaExenta = 0;
  let sumaNoSuj = 0;
  let sumaIvaItems = 0;

  for (const item of items) {
    sumaGravada += Number(item?.ventaGravada || 0);
    sumaExenta += Number(item?.ventaExenta || 0);
    sumaNoSuj += Number(item?.ventaNoSuj || 0);
    sumaIvaItems += Number(item?.ivaItem || 0);
  }

  return { sumaGravada, sumaExenta, sumaNoSuj, sumaIvaItems };
};

export type Fe01Expectations = {
  totalGravadaBase: number;
  subTotalVentas: number;
  subTotal: number;
  totalIva: number;
  montoTotalOperacion: number;
  totalPagar: number;
};

// FE-01 (Factura Consumidor Final): misma matemática que CCF-03.
//  - ÍTEMS (cuerpoDocumento) vienen SIN IVA (base):
//      precioUni, ventaGravada = base sin IVA
//      ivaItem = ventaGravada * 0.13 (IVA calculado sobre base)
//  - RESUMEN también en base sin IVA, IVA se suma al final:
//      totalGravada = sum(ventaGravada) (base)
//      totalIva = sum(ivaItem)
//      montoTotalOperacion = subTotal + totalIva (suma IVA)
//      totalPagar = montoTotalOperacion
// Única diferencia con CCF-03: FE-01 usa ivaItem por línea y resumen.totalIva;
// CCF-03 no tiene ivaItem y en lugar usa resumen.tributos[{codigo:'20'}].
// El código '20' NO está permitido en FE-01 (schema fe-fc-v1).
export const computeFe01Expectations = (resumen: any, totals: ItemTotals): Fe01Expectations => {
  const totalGravadaBase = round2(totals.sumaGravada);
  const subTotalVentas = round2(totalGravadaBase + totals.sumaExenta + totals.sumaNoSuj);
  const descuentosGlobales = round2(
    Number(resumen?.descuNoSuj || 0) + Number(resumen?.descuExenta || 0) + Number(resumen?.descuGravada || 0)
  );
  const subTotal = round2(subTotalVentas - descuentosGlobales);
  const totalIva = round2(totals.sumaIvaItems);

  const montoTotalOperacion = round2(
    subTotal
    + totalIva
    + Number(resumen?.totalNoGravado || 0)
    - Number(resumen?.ivaRete1 || 0)
    - Number(resumen?.reteRenta || 0)
    + Number(resumen?.saldoFavor || 0)
  );

  return {
    totalGravadaBase,
    subTotalVentas,
    subTotal,
    totalIva,
    montoTotalOperacion,
    totalPagar: montoTotalOperacion,
  };
};

export type Ccf03Expectations = {
  subTotalVentas: number;
  subTotal: number;
  montoTotalOperacion: number;
  totalPagar: number;
};

export const computeCcf03Expectations = (resumen: any, totals: ItemTotals, totalIva: number): Ccf03Expectations => {
  const subTotalVentas = round2(totals.sumaGravada + totals.sumaExenta + totals.sumaNoSuj);
  const descuentosGlobales = round2(
    Number(resumen?.descuNoSuj || 0) + Number(resumen?.descuExenta || 0) + Number(resumen?.descuGravada || 0)
  );
  const subTotal = round2(subTotalVentas - descuentosGlobales);
  const montoTotalOperacion = round2(subTotal + Number(resumen?.totalNoGravado || 0) + totalIva);
  const totalPagar = round2(
    montoTotalOperacion
    - Number(resumen?.ivaRete1 || 0)
    - Number(resumen?.reteRenta || 0)
    + Number(resumen?.saldoFavor || 0)
  );

  return { subTotalVentas, subTotal, montoTotalOperacion, totalPagar };
};
