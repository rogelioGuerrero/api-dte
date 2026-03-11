import { config } from 'dotenv';
import { resolve } from 'path';

// 1. Cargar variables de entorno PRIMERO
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

// Validar que las variables esenciales existan antes de importar los módulos
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌ ERROR: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_KEY");
  console.error("Por favor, asegúrate de que el archivo .env esté configurado correctamente en:", envPath);
  process.exit(1);
}

// 2. Importaciones dinámicas DESPUÉS de cargar las variables de entorno
async function main() {
  try {
    const { dteGraph } = await import('../src/workflows/dteWorkflow');

    // JSON proporcionado por el usuario
    const mockDte = {
      "identificacion": {
        "version": 1,
        "ambiente": "00",
        "tipoDte": "01",
        "numeroControl": "DTE-01-M001P001-000000000000011",
        "codigoGeneracion": "88221AE2-1E88-428B-8CC0-6A4F1B8DA93C",
        "tipoModelo": 1,
        "tipoOperacion": 1,
        "tipoContingencia": null,
        "motivoContin": null,
        "fecEmi": "2026-03-11",
        "horEmi": "15:13:27",
        "tipoMoneda": "USD"
      },
      "documentoRelacionado": null,
      "emisor": {
        "nit": "14012805761025",
        "nrc": "1571266",
        "nombre": "Rogelio Guerrero",
        "codActividad": "96092",
        "descActividad": "Servicios n.c.p.",
        "nombreComercial": null,
        "tipoEstablecimiento": "01",
        "codEstable": "M001",
        "codPuntoVenta": "P001",
        "direccion": {
          "departamento": "06",
          "municipio": "15",
          "complemento": "dañdkñadalkñ"
        },
        "telefono": "79293710",
        "correo": "guerrero_vi@yahoo.com",
        "codEstableMH": "M001",
        "codPuntoVentaMH": "P001"
      },
      "receptor": {
        "tipoDocumento": null,
        "numDocumento": null,
        "nrc": null,
        "nombre": "Consumidor Final",
        "codActividad": null,
        "descActividad": null,
        "direccion": null,
        "telefono": null,
        "correo": ""
      },
      "otrosDocumentos": null,
      "ventaTercero": null,
      "cuerpoDocumento": [
        {
          "numItem": 1,
          "tipoItem": 1,
          "cantidad": 1,
          "codigo": "VAR-001",
          "uniMedida": 99,
          "descripcion": "LIMPI",
          "precioUni": 1.4,
          "montoDescu": 0,
          "ventaNoSuj": 0,
          "ventaExenta": 0,
          "ventaGravada": 1.4,
          "tributos": null,
          "numeroDocumento": null,
          "codTributo": null,
          "psv": 0,
          "noGravado": 0,
          "ivaItem": 0
        }
      ],
      "resumen": {
        "totalNoSuj": 0,
        "totalExenta": 0,
        "totalGravada": 1.4,
        "subTotalVentas": 1.4,
        "descuNoSuj": 0,
        "descuExenta": 0,
        "descuGravada": 0,
        "porcentajeDescuento": 0,
        "totalDescu": 0,
        "totalIva": 0,
        "tributos": null,
        "subTotal": 1.4,
        "ivaRete1": 0,
        "reteRenta": 0,
        "montoTotalOperacion": 1.4,
        "totalNoGravado": 0,
        "totalCargosNoBase": 0,
        "ivaPerci1": 0,
        "totalPagar": 1.4,
        "totalLetras": "UN DÓLAR CON 40/100 USD",
        "saldoFavor": 0,
        "condicionOperacion": 1,
        "pagos": [
          {
            "codigo": "01",
            "montoPago": 1.4,
            "referencia": null,
            "plazo": null,
            "periodo": null
          }
        ],
        "numPagoElectronico": null
      },
      "extension": null,
      "apendice": null
    };

    const initialState = {
      dte: mockDte as any,
      ambiente: '00' as const,
      flowType: 'emission' as const,
      nit: '14012805761025',
      businessId: 'f0b09b0b-8458-4c59-a32a-953e432f7019',
      isSigned: false,
      status: 'pending',
      progressPercentage: 10,
      currentStep: 'init',
      validationErrors: [],
    };

    console.log("🚀 Iniciando prueba del flujo de DTE con nuevo JSON...");
    console.log("Estado inicial:", JSON.stringify({
      flowType: initialState.flowType,
      ambiente: initialState.ambiente,
      nit: initialState.nit
    }, null, 2));

    const finalState = await dteGraph.invoke(initialState);

    console.log("\n=============================================");
    console.log("🏁 ESTADO FINAL DEL FLUJO");
    console.log("=============================================");
    console.log("Status final:", finalState.status);
    console.log("Es válido?:", finalState.isValid);
    console.log("Errores de validación:", finalState.validationErrors);
    console.log("Está firmado?:", finalState.isSigned);
    if (finalState.signature) {
      console.log("Firma JWS generada (primeros 50 caracteres):", finalState.signature.substring(0, 50) + "...");
    }
    
  } catch (error) {
    console.error("❌ Error no controlado durante la prueba:", error);
  }
}

main();
