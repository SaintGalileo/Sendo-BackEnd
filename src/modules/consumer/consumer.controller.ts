import { Request, Response } from 'express';
import { ConsumerService } from './consumer.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';

const consumerService = new ConsumerService();

export class ConsumerController {
    async getProfile(req: AuthRequest, res: Response) {
        try {
            const profile = await consumerService.getProfile(req.user.id);
            return sendResponse(res, 200, true, 'Profile fetched successfully', profile);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateProfile(req: AuthRequest, res: Response) {
        try {
            const profile = await consumerService.updateProfile(req.user.id, req.body);
            return sendResponse(res, 200, true, 'Profile updated successfully', profile);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteAccount(req: AuthRequest, res: Response) {
        try {
            await consumerService.deleteAccount(req.user.id);
            return sendResponse(res, 200, true, 'Account deleted successfully');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // --- Addresses ---
    async getAddresses(req: AuthRequest, res: Response) {
        try {
            const addresses = await consumerService.getAddresses(req.user.id);
            return sendResponse(res, 200, true, 'Addresses fetched successfully', addresses);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async createAddress(req: AuthRequest, res: Response) {
        try {
            const address = await consumerService.createAddress(req.user.id, req.body);
            return sendResponse(res, 201, true, 'Address created successfully', address);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateAddress(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const address = await consumerService.updateAddress(req.user.id, id as string, req.body);
            return sendResponse(res, 200, true, 'Address updated successfully', address);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteAddress(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await consumerService.deleteAddress(req.user.id, id as string);
            return sendResponse(res, 200, true, 'Address deleted successfully');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // --- Favorites ---
    async getFavorites(req: AuthRequest, res: Response) {
        try {
            const favorites = await consumerService.getFavorites(req.user.id);
            return sendResponse(res, 200, true, 'Favorites fetched successfully', favorites);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async addFavorite(req: AuthRequest, res: Response) {
        try {
            const { storeId } = req.params;
            const favorite = await consumerService.addFavorite(req.user.id, storeId as string);
            return sendResponse(res, 201, true, 'Favorite added successfully', favorite);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async removeFavorite(req: AuthRequest, res: Response) {
        try {
            const { storeId } = req.params;
            await consumerService.removeFavorite(req.user.id, storeId as string);
            return sendResponse(res, 200, true, 'Favorite removed successfully');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
