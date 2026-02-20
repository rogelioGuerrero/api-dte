import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { getAccumulator, saveAccumulator, getAllAccumulators } from '../tax/taxStorage';
import { createEmptyAccumulator, updateTaxAccumulator, getPeriodFromDate } from '../tax/taxCalculator';
import { getDTEsByPeriod } from '../dte/dteStorage';
import { processJsonContent } from '../processing/processor';
import { VENTAS_CONFIG, COMPRAS_CONFIG, generateHeaderRow } from '../exports/fieldMapping';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const logger = createLogger('taxController');

// GET /api/tax/accumulators/:period
router.get('/accumulators/:period', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period } = req.params;
    const businessId = req.headers['x-business-id'] as string;
    
    if (!businessId) {
      throw createError('Business ID not found', 400);
    }
    
    logger.info('Getting tax accumulators', { period, businessId });
    
    const accumulator = await getAccumulator(businessId, period, 'ALL');
    
    if (!accumulator) {
      throw createError('Accumulator not found', 404);
    }
    
    res.json({
      period,
      accumulator
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tax/accumulators
router.post('/accumulators', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period, accumulator } = req.body;
    const nitEmisor = req.user?.nit;
    
    if (!period || !accumulator) {
      throw createError('Period and accumulator are required', 400);
    }
    
    if (!nitEmisor) {
      throw createError('User NIT not found', 400);
    }
    
    // Asegurar que el acumulador tenga el NIT correcto
    accumulator.nit_emisor = nitEmisor;
    accumulator.period = period;
    
    logger.info('Updating tax accumulators', { period, nitEmisor });
    
    await saveAccumulator(accumulator);
    
    res.json({
      updated: true,
      period,
      accumulator
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tax/f14/:period
router.get('/f14/:period', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period } = req.params;
    const businessId = req.headers['x-business-id'] as string;
    
    if (!businessId) {
      throw createError('Business ID not found', 400);
    }
    
    logger.info('Generating F14', { period, businessId });
    
    const accumulator = await getAccumulator(businessId, period, 'ALL');
    
    if (!accumulator) {
      throw createError('Accumulator not found', 404);
    }
    
    // Calcular F14 (1% del IVA débito fiscal)
    const ivaDebito = accumulator.total_iva || 0;
    const f14Value = Math.round(ivaDebito * 0.01 * 100) / 100; // Redondear a 2 decimales
    
    const f14 = {
      period,
      businessId,
      ivaDebito,
      f14Value,
      fechaLimitePago: getDeadlineDate(period), // Últimos 5 días del mes siguiente
      estado: f14Value > 0 ? 'PENDIENTE' : 'NO_APLICA'
    };
    
    res.json({
      period,
      f14
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tax/export/csv
router.get('/export/csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period, type = 'ventas' } = req.query;
    const nitEmisor = req.user?.nit;
    
    if (!nitEmisor) {
      throw createError('User NIT not found', 400);
    }

    if (typeof period !== 'string') {
        throw createError('Period is required', 400);
    }
    
    logger.info('Exporting CSV for DGII', { period, type, nitEmisor });
    
    // Calcular rango de fechas
    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${period}-${lastDay.toString().padStart(2, '0')}`;

    // Obtener DTEs del periodo
    const dtes = await getDTEsByPeriod(startDate, endDate, nitEmisor);

    // Configuración según tipo
    const config = type === 'compras' ? COMPRAS_CONFIG : VENTAS_CONFIG;
    const mode = type === 'compras' ? 'compras' : 'ventas';

    // Generar CSV
    let csvContent = generateHeaderRow(config);
    const processedData: any[] = [];

    for (const doc of dtes) {
        const result = processJsonContent(
            doc.codigo_generacion,
            JSON.stringify(doc.dte_json),
            config,
            mode
        );
        
        if (result.isValid) {
            csvContent += result.csvLine;
            processedData.push({
                ...result.data,
                id: doc.id,
                estado: doc.estado
            });
        }
    }
    
    res.json({
      exported: true,
      csvContent,
      data: processedData,
      count: processedData.length,
      period,
      type
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tax/accumulators
router.get('/accumulators', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const nitEmisor = req.user?.nit;
    
    if (!nitEmisor) {
      throw createError('User NIT not found', 400);
    }
    
    logger.info('Getting all tax accumulators', { nitEmisor });
    
    const accumulators = await getAllAccumulators(nitEmisor);
    
    res.json({
      accumulators,
      total: accumulators.length
    });
  } catch (error) {
    next(error);
  }
});

// Función auxiliar para calcular fecha límite de pago F14
function getDeadlineDate(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  
  // Últimos 5 días del mes siguiente
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  const deadlineDay = lastDay - 4; // 5 días antes del fin del mes
  
  return `${nextYear}-${nextMonth.toString().padStart(2, '0')}-${deadlineDay.toString().padStart(2, '0')}`;
}

export default router;
