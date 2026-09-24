import { Router } from 'express';
import { ServiceabilityController } from './serviceability.controller';

const router = Router();
const controller = new ServiceabilityController();

router.get('/', controller.check.bind(controller));

export default router;
