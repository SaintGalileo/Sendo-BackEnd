import { Router } from 'express';
import { UtilityController } from './utility.controller';

const router = Router();
const ctrl = new UtilityController();

router.get('/contacts', (req, res) => ctrl.getContacts(req, res));

export default router;
