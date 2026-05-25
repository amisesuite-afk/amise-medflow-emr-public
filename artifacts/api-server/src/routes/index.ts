import { Router, type IRouter } from "express";
import healthRouter from "./health";
import intakeRouter from "./intake";
import triagePreviewRouter from "./triage-preview";
import cronRouter from "./cron";
import summaryRouter from "./summary";
import schedulingRouter from "./scheduling";
import bookingRouter from "./booking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(intakeRouter);
router.use(triagePreviewRouter);
router.use(cronRouter);
router.use(summaryRouter);
router.use(schedulingRouter);
router.use(bookingRouter);

export default router;
