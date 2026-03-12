import { Request, Response } from 'express';
import { StoresService } from './stores.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const storesService = new StoresService();

export class StoresController {
    async getStores(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const { type, lat, lng, rating, q, city } = req.query;

            const filters = {
                type: type as string,
                lat: lat as string,
                lng: lng as string,
                rating: rating as string,
                search: q as string, // for /stores/search alias or normal query
                city: city as string,
            };

            const result = await storesService.getStores(filters, pagination);
            return sendResponse(
                res,
                200,
                true,
                'Stores fetched successfully',
                formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getNearbyStores(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const result = await storesService.getNearbyStores(req.user.id, pagination);
            return sendResponse(
                res,
                200,
                true,
                'Nearby restaurants fetched successfully',
                formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getFeaturedStores(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const result = await storesService.getFeaturedStores(pagination);
            return sendResponse(
                res,
                200,
                true,
                'Featured restaurants fetched successfully',
                formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoresByCity(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const result = await storesService.getStoresByCity(req.user.id, pagination);
            return sendResponse(
                res,
                200,
                true,
                'Restaurants in your city fetched successfully',
                formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoreById(req: Request, res: Response) {
        try {
            const store = await storesService.getStoreById(req.params.storeId as string);
            return sendResponse(res, 200, true, 'Store fetched successfully', store);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoreMenu(req: Request, res: Response) {
        try {
            const menu = await storesService.getStoreMenu(req.params.storeId as string);
            return sendResponse(res, 200, true, 'Store menu fetched successfully', menu);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoreCategories(req: Request, res: Response) {
        try {
            const categories = await storesService.getStoreCategories(req.params.storeId as string);
            return sendResponse(res, 200, true, 'Store categories fetched successfully', categories);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoreProducts(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const products = await storesService.getStoreProducts(req.params.storeId as string, pagination);
            return sendResponse(
                res,
                200,
                true,
                'Store products fetched successfully',
                formatPaginatedResponse(products.data, products.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
