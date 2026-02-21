import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('licensingController');

// GET /api/licensing/config
// Público: El frontend lo consulta al iniciar
router.get('/config', (req: Request, res: Response) => {
  res.json({
    enabled: true,
    announcement: process.env.ANNOUNCEMENT_MSG || "",
    forceUserModeSelection: false,
    minVersion: "1.0.0",
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    maintenanceMessage: process.env.MAINTENANCE_MSG || "Sistema en mantenimiento",
    dailyExportLimit: parseInt(process.env.DAILY_EXPORT_LIMIT || '5', 10)
  });
});

export default router;
