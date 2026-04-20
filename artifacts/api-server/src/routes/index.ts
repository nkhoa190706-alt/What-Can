import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import telemetryRouter from "./telemetry";
import alertsRouter from "./alerts";
import statsRouter from "./stats";
import connectRouter from "./connect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devicesRouter);
router.use(telemetryRouter);
router.use(alertsRouter);
router.use(statsRouter);
router.use(connectRouter);

export default router;
