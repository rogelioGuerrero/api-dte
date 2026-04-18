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

// FE-01 (Factura Consumidor Final): modelo híbrido MH.
//  - ÍTEMS (cuerpoDocumento) vienen con IVA INCLUIDO:
//      precioUni, ventaGravada = con IVA
//      ivaItem = ventaGravada - ventaGravada/1.13  (IVA contenido en el precio)
//  - RESUMEN usa BASE sin IVA:
//      totalGravada = sum(ventaGravada) / 1.13
//      totalIva = sum(ivaItem)
//      montoTotalOperacion = subTotal + totalIva (vuelve a subir al monto con IVA)
//      totalPagar = montoTotalOperacion
// Por eso FE-01 se diferencia de CCF-03: en CCF los ítems ya vienen sin IVA.
export const computeFe01Expectations = (resumen: any, totals: ItemTotals): Fe01Expectations => {
  const totalGravadaBase = round2(totals.sumaGravada / 1.13);
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
