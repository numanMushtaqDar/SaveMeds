import { Router, type IRouter } from "express";
import auditRouter from "./audit";
import healthRouter from "./health";
import medicinesRouter from "./medicines";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auditRouter);
router.use(medicinesRouter);

export default router;
