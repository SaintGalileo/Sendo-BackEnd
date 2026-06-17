import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';

const trackingService = new TrackingService();

export class TrackingController {
    // Note: GET /orders/:orderId/location is actually handled by consumer orders controller getOrderTracking in a real app,
    // or we can route it here specifically for just location polling.
    // The prompt asks for POST /courier/location which we implement here.

    async updateLocation(req: AuthRequest, res: Response) {
        try {
            const { lat, lng } = req.body;
            if (lat === undefined || lng === undefined) {
                return sendResponse(res, 400, false, 'Latitude and longitude are required');
            }

            const location = await trackingService.updateCourierLocation(req.user.id, lat, lng);
            return sendResponse(res, 200, true, 'Location updated successfully', location);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
