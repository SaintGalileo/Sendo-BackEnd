import { Request, Response } from 'express';
import { CourierService } from './courier.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';
import { OrderStatus } from '../../common/constants/orderStatus';

const courierService = new CourierService();

export class CourierController {
    // Profile
    async getProfile(req: AuthRequest, res: Response) {
        try {
            const profile = await courierService.getProfile(req.user.id);
            return sendResponse(res, 200, true, 'Profile fetched', profile);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateProfile(req: AuthRequest, res: Response) {
        try {
            const profile = await courierService.updateProfile(req.user.id, req.body);
            return sendResponse(res, 200, true, 'Profile updated', profile);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // Availability
    async goOnline(req: AuthRequest, res: Response) {
        try {
            const status = await courierService.setOnlineStatus(req.user.id, true);
            return sendResponse(res, 200, true, 'Courier is now online', status);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async goOffline(req: AuthRequest, res: Response) {
        try {
            const status = await courierService.setOnlineStatus(req.user.id, false);
            return sendResponse(res, 200, true, 'Courier is now offline', status);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStatus(req: AuthRequest, res: Response) {
        try {
            const status = await courierService.getStatus(req.user.id);
            return sendResponse(res, 200, true, 'Courier status fetched', status);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // Orders available
    async getAvailableOrders(req: AuthRequest, res: Response) {
        try {
            const orders = await courierService.getAvailableOrders();
            return sendResponse(res, 200, true, 'Available orders fetched', orders);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async acceptOrder(req: AuthRequest, res: Response) {
        try {
            const order = await courierService.acceptOrder(req.user.id, req.params.orderId as string);
            return sendResponse(res, 200, true, 'Order accepted', order);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async rejectOrder(req: AuthRequest, res: Response) {
        try {
            await courierService.rejectOrder(req.user.id, req.params.orderId as string);
            return sendResponse(res, 200, true, 'Order rejected');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // Delivery Process
    async pickedUpOrder(req: AuthRequest, res: Response) {
        try {
            const order = await courierService.updateOrderDeliveryStatus(req.user.id, req.params.orderId as string, OrderStatus.PICKED_UP);
            return sendResponse(res, 200, true, 'Order picked up', order);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async deliveredOrder(req: AuthRequest, res: Response) {
        try {
            const order = await courierService.updateOrderDeliveryStatus(req.user.id, req.params.orderId as string, OrderStatus.DELIVERED);
            // Additionally can take proof of delivery in body here
            return sendResponse(res, 200, true, 'Order delivered', order);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async cancelDelivery(req: AuthRequest, res: Response) {
        try {
            // E.g. issue with vehicle
            const order = await courierService.updateOrderDeliveryStatus(req.user.id, req.params.orderId as string, OrderStatus.READY_FOR_PICKUP);
            // Also unset courier_id in a real system so it can be re-assigned. 
            // Simplified here.
            return sendResponse(res, 200, true, 'Delivery cancelled by courier, order returned to pool', order);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    // Earnings
    async getEarnings(req: AuthRequest, res: Response) {
        try {
            const earnings = await courierService.getEarnings(req.user.id);
            return sendResponse(res, 200, true, 'Earnings fetched', earnings);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getEarningsHistory(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const earnings = await courierService.getEarningsHistory(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Earnings history fetched', formatPaginatedResponse(earnings.data, earnings.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
