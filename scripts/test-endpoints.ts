import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 3002;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

// Datos de usuario simulados
const user = {
  id: '123',
  nit: '06140101901010',
  email: 'test@example.com'
};

// Generar token
const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });

console.log('🔑 Token generado:', token);

async function testEndpoints() {
  try {
    // 1. Health Check (Público)
    console.log('\n📡 Probando Health Check...');
    try {
      const healthRes = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Health Check OK:', healthRes.data);
    } catch (error: any) {
      console.error('❌ Health Check Failed:', error.message);
    }

    // 2. Endpoint Protegido (DTE Validate) sin Token
    console.log('\n🔒 Probando Endpoint Protegido (sin token)...');
    try {
      await axios.post(`${BASE_URL}/api/dte/validate`, {});
      console.error('❌ Falló la prueba: Debería haber rechazado el acceso');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ Acceso rechazado correctamente (401)');
      } else {
        console.error('❌ Error inesperado:', error.message);
      }
    }

    // 3. Endpoint Protegido con Token (DTE Validate)
    console.log('\n🔓 Probando Endpoint Protegido (con token)...');
    try {
      // DTE completo para validar (Factura - 01)
      const dteMock = {
        identificacion: {
          version: 1,
          ambiente: "00",
          tipoDte: "01",
          numeroControl: "DTE-01-00000000-000000000000001",
          codigoGeneracion: "00000000-0000-4000-8000-000000000000",
          tipoModelo: 1,
          tipoOperacion: 1,
          fecEmi: "2024-01-01",
          horEmi: "12:00:00",
          tipoMoneda: "USD"
        },
        emisor: {
          nit: "06140101901010",
          nrc: "123456",
          nombre: "EMISOR EJEMPLO",
          codActividad: "12345",
          descActividad: "VENTA DE COSAS",
          tipoEstablecimiento: "01",
          direccion: {
            departamento: "01",
            municipio: "01",
            complemento: "DIRECCION"
          },
          telefono: "22222222",
          correo: "emisor@example.com"
        },
        receptor: {
          nombre: "CLIENTE EJEMPLO",
          tipoDocumento: "36",
          numDocumento: "06140101901010",
          correo: "cliente@example.com"
        },
        cuerpoDocumento: [
          {
            numItem: 1,
            tipoItem: 1,
            cantidad: 1,
            descripcion: "ITEM 1",
            precioUni: 10,
            montoDescu: 0,
            ventaNoSuj: 0,
            ventaExenta: 0,
            ventaGravada: 10,
            tributos: ["20"],
            psv: 0,
            noGravado: 0,
            ivaItem: 1.3
          }
        ],
        resumen: {
          totalNoSuj: 0,
          totalExenta: 0,
          totalGravada: 10,
          subTotalVentas: 10,
          descuNoSuj: 0,
          descuExenta: 0,
          descuGravada: 0,
          porcentajeDescuento: 0,
          totalDescu: 0,
          totalIva: 1.3,
          tributos: [
            {
              codigo: "20",
              descripcion: "IVA",
              valor: 1.3
            }
          ],
          subTotal: 10,
          ivaRete1: 0,
          reteRenta: 0,
          montoTotalOperacion: 11.3,
          totalNoGravado: 0,
          totalPagar: 11.3,
          totalLetras: "ONCE 30/100 USD",
          saldoFavor: 0,
          condicionOperacion: 1,
          pagos: [
              {
                  codigo: "01",
                  montoPago: 11.3,
                  referencia: null,
                  plazo: null,
                  periodo: null
              }
          ],
          numPagoElectronico: null
        }
      };

      const validateRes = await axios.post(
        `${BASE_URL}/api/dte/validate`, 
        { dte: dteMock },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log('✅ DTE Validate Response:', JSON.stringify(validateRes.data, null, 2));
    } catch (error: any) {
      console.error('❌ DTE Validate Failed:', error.response?.data || error.message);
    }

    // 4. Endpoint de Impuestos (GET Accumulator)
    console.log('\n💰 Probando Endpoint de Impuestos (GET /accumulators)...');
    try {
      const period = '2024-01';
      await axios.get(
        `${BASE_URL}/api/tax/accumulators/${period}`, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log('✅ Tax Accumulator Found (Unexpected if no DB)');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('✅ Tax Accumulator Not Found (Esperado sin DB real - 404)');
      } else {
        console.error('❌ Tax Request Failed:', error.response?.data || error.message);
      }
    }

    // 5. Endpoint de Batch (POST /ingest)
    console.log('\n📦 Probando Endpoint de Batch (POST /ingest)...');
    try {
      const dteBatchMock = {
        identificacion: {
          version: 1,
          ambiente: "00",
          tipoDte: "01",
          numeroControl: "DTE-01-12345678-000000000000001",
          codigoGeneracion: "00000000-0000-4000-8000-000000000000",
          tipoModelo: 1,
          tipoOperacion: 1,
          fecEmi: "2024-01-01",
          horEmi: "12:00:00",
          tipoMoneda: "USD"
        },
        emisor: {
          nit: "06140101901010",
          nrc: "123456",
          nombre: "EMISOR BATCH",
          codActividad: "12345",
          descActividad: "VENTA",
          tipoEstablecimiento: "01",
          direccion: {
            departamento: "01",
            municipio: "01",
            complemento: "DIR"
          },
          telefono: "22222222",
          correo: "emisor@example.com"
        },
        receptor: {
          nombre: "CLIENTE BATCH",
          tipoDocumento: "36",
          numDocumento: "06140101901010",
          correo: "cliente@example.com"
        },
        cuerpoDocumento: [
          {
            numItem: 1,
            tipoItem: 1,
            cantidad: 1,
            descripcion: "ITEM BATCH",
            precioUni: 2000, // Aumentar precio para superar $1095
            montoDescu: 0,
            ventaNoSuj: 0,
            ventaExenta: 0,
            ventaGravada: 2000,
            tributos: ["20"],
            psv: 0,
            noGravado: 0,
            ivaItem: 260
          }
        ],
        resumen: {
          totalNoSuj: 0,
          totalExenta: 0,
          totalGravada: 2000,
          subTotalVentas: 2000,
          descuNoSuj: 0,
          descuExenta: 0,
          descuGravada: 0,
          porcentajeDescuento: 0,
          totalDescu: 0,
          totalIva: 260,
          tributos: [{ codigo: "20", descripcion: "IVA", valor: 260 }],
          subTotal: 2000,
          ivaRete1: 0,
          reteRenta: 0,
          montoTotalOperacion: 2260,
          totalNoGravado: 0,
          totalPagar: 2260,
          totalLetras: "DOS MIL DOSCIENTOS SESENTA 00/100 USD",
          saldoFavor: 0,
          condicionOperacion: 1,
          pagos: [{ codigo: "01", montoPago: 2260, referencia: null, plazo: null, periodo: null }],
          numPagoElectronico: null
        }
      };

      const batchPayload = {
        dtes: [
          { dte: dteBatchMock, mode: 'ventas' }
        ],
        passwordPri: "TEST_PASSWORD"
      };

      const batchRes = await axios.post(
        `${BASE_URL}/api/batch/ingest`,
        batchPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log(' Batch Ingest Response:', JSON.stringify(batchRes.data, null, 2));
    } catch (error: any) {
      console.error(' Batch Ingest Failed:', error.response?.data || error.message);
    }

    // 6. Endpoint F14 (GET /f14)
    console.log('\n Probando Endpoint F14 (GET /f14)...');
    try {
      const period = '2024-01';
      await axios.get(
        `${BASE_URL}/api/tax/f14/${period}`, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log(' F14 Generated (Unexpected if no DB)');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(' F14 Not Found (Esperado sin DB real - 404)');
      } else {
        console.error(' F14 Request Failed:', error.response?.data || error.message);
      }
    }

    // 7. Endpoint CSV (GET /export/csv)
    console.log('\n Probando Endpoint CSV (GET /export/csv)...');
    try {
      const csvRes = await axios.get(
        `${BASE_URL}/api/tax/export/csv?period=2024-01&type=ventas`, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log(' CSV Export OK:', csvRes.data);
    } catch (error: any) {
      console.error(' CSV Export Failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Error general:', error);
  }
}

testEndpoints();
