import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';

const router = Router();
const notificationsController = new NotificationsController();

router.use(authMiddleware);

router.get('/', notificationsController.getNotifications);
router.post('/read', notificationsController.readNotifications);
router.post('/device-token', notificationsController.registerDeviceToken);
router.post('/fcm-token', notificationsController.updateFcmToken);

export default router;
