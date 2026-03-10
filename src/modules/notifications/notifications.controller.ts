import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const notificationsService = new NotificationsService();

export class NotificationsController {
    async getNotifications(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const notifications = await notificationsService.getNotifications(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Notifications fetched', formatPaginatedResponse(notifications.data, notifications.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async readNotifications(req: AuthRequest, res: Response) {
        try {
            const { notificationIds } = req.body; // array of IDs
            if (!notificationIds || !Array.isArray(notificationIds)) {
                return sendResponse(res, 400, false, 'notificationIds array is required');
            }

            await notificationsService.markAsRead(req.user.id, notificationIds);
            return sendResponse(res, 200, true, 'Notifications marked as read');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async registerDeviceToken(req: AuthRequest, res: Response) {
        try {
            const { token, deviceType } = req.body;
            if (!token) return sendResponse(res, 400, false, 'Token is required');

            const device = await notificationsService.registerDeviceToken(req.user.id, token, deviceType);
            return sendResponse(res, 201, true, 'Device token registered', device);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
