import { Router, type IRouter } from "express";
import healthRouter from "./health";
import intakeRouter from "./intake";
import triagePreviewRouter from "./triage-preview";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(intakeRouter);
router.use(triagePreviewRouter);
router.use(cronRouter);

export default router;
