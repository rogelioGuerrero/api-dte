// Prueba live FE-01 contra api-dte.onrender.com
// Usa: node tmp-fe01-live.js

const crypto = require('crypto');

const BASE = 'https://api-dte.onrender.com';

function uuid() {
  return crypto.randomUUID().toUpperCase();
}

function pad(n, len) { return String(n).padStart(len, '0'); }

function buildFe01Payload(sequence = 1) {
  const codigoGeneracion = uuid();
  const now = new Date();
  const fecEmi = now.toISOString().slice(0, 10);
  const horEmi = now.toTimeString().slice(0, 8);
  const numeroControl = `DTE-01-M010P010-${pad(sequence, 15)}`;

  // Caso: consumidor final compra un servicio por $10 (con IVA) sin descuento.
  // Modelo híbrido FE-01:
  //  ítem: precioUni y ventaGravada CON IVA, ivaItem = ventaGravada - ventaGravada/1.13
  //  resumen: totalGravada = sum(ventaGravada)/1.13 (BASE)
  const precioUniConIVA = 10.0;
  const cantidad = 1;
  const montoDescu = 0;
  const ventaGravada = +(cantidad * precioUniConIVA - montoDescu).toFixed(8);
  const ivaItem = +(ventaGravada - ventaGravada / 1.13).toFixed(8); // 1.15044248
  const totalGravadaBase = +(ventaGravada / 1.13).toFixed(2); // 8.85
  const totalIva = +ivaItem.toFixed(2); // 1.15
  const subTotalVentas = totalGravadaBase;
  const subTotal = subTotalVentas;
  const montoTotalOperacion = +(subTotal + totalIva).toFixed(2); // 10.00
  const totalPagar = montoTotalOperacion;

  return {
    identificacion: {
      version: 1,
      ambiente: '00',
      tipoDte: '01',
      numeroControl,
      codigoGeneracion,
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi,
      horEmi,
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: {
      nit: '14012805761025',
      nrc: '1571266',
      nombre: 'Rogelio Guerrero',
      codActividad: '96092',
      descActividad: 'Servicios n.c.p.',
      nombreComercial: null,
      tipoEstablecimiento: '01',
      direccion: { departamento: '06', municipio: '15', complemento: 'kalalal' },
      telefono: '79293710',
      correo: 'guerrero_vi@yahoo.com',
      codEstableMH: 'M010',
      codEstable: null,
      codPuntoVentaMH: 'P010',
      codPuntoVenta: null,
    },
    receptor: {
      tipoDocumento: null,
      numDocumento: null,
      nrc: null,
      nombre: 'Consumidor Final',
      codActividad: null,
      descActividad: null,
      direccion: { departamento: '06', municipio: '15', complemento: 'DIRECCION NO ESPECIFICADA' },
      telefono: null,
      correo: 'agti.sa.cv@gmail.com',
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: [
      {
        numItem: 1,
        tipoItem: 2,
        numeroDocumento: null,
        codigo: null,
        codTributo: null,
        descripcion: 'Servicio de prueba FE-01',
        cantidad,
        uniMedida: 59,
        precioUni: precioUniConIVA,
        montoDescu,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: ['20'],
        psv: 0,
        noGravado: 0,
        ivaItem,
      },
    ],
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada: totalGravadaBase,
      subTotalVentas: subTotal,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: 0,
      porcentajeDescuento: 0,
      totalDescu: 0,
      tributos: [
        { codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: totalIva },
      ],
      subTotal,
      totalIva,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar,
      totalLetras: 'DIEZ DÓLARES CON 00/100 USD',
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: [{ codigo: '01', montoPago: totalPagar, referencia: null, plazo: null, periodo: null }],
      numPagoElectronico: null,
    },
    extension: { nombEntrega: null, docuEntrega: null, nombRecibe: null, docuRecibe: null, observaciones: null, placaVehiculo: null },
    apendice: null,
  };
}

async function getDevToken() {
  const r = await fetch(`${BASE}/api/test/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin' }),
  });
  const j = await r.json();
  return j.accessToken;
}

async function processDTE(token, payload) {
  const r = await fetch(`${BASE}/api/dte/transmit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dte: payload, ambiente: '00' }),
  });
  return { status: r.status, body: await r.json() };
}

(async () => {
  const seq = Number(process.argv[2] || Date.now().toString().slice(-3));
  const token = await getDevToken();
  console.log('Got dev token');
  const payload = buildFe01Payload(seq);
  console.log('Sending FE-01 payload with numeroControl =', payload.identificacion.numeroControl);
  console.log('  item.ventaGravada =', payload.cuerpoDocumento[0].ventaGravada);
  console.log('  item.ivaItem      =', payload.cuerpoDocumento[0].ivaItem);
  console.log('  resumen.totalGravada        =', payload.resumen.totalGravada);
  console.log('  resumen.subTotal            =', payload.resumen.subTotal);
  console.log('  resumen.totalIva            =', payload.resumen.totalIva);
  console.log('  resumen.montoTotalOperacion =', payload.resumen.montoTotalOperacion);
  console.log('  resumen.totalPagar          =', payload.resumen.totalPagar);

  const result = await processDTE(token, payload);
  console.log('HTTP', result.status);
  console.log(JSON.stringify(result.body, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
