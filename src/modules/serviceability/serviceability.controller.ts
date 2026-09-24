import { Request, Response } from 'express';
import { ServiceabilityService } from './serviceability.service';
import { sendResponse } from '../../common/utils/response';

const serviceabilityService = new ServiceabilityService();

export class ServiceabilityController {
    async check(req: Request, res: Response) {
        try {
            const lat = parseFloat(String(req.query.lat ?? ''));
            const lng = parseFloat(String(req.query.lng ?? ''));

            if (isNaN(lat) || isNaN(lng)) {
                return sendResponse(res, 400, false, 'lat and lng query params are required');
            }

            const result = await serviceabilityService.check(lat, lng);
            return sendResponse(res, 200, true, 'Serviceability checked', result);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message || 'Serviceability check failed');
        }
    }
}
