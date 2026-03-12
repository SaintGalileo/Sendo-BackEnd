import { Request, Response } from 'express';
import { MerchantOnboardingService } from './merchant.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const merchantService = new MerchantOnboardingService();

export class MerchantController {
    // --- Store Management ---
    async registerStore(req: Request, res: Response) {
        try {
            const {
                userId,
                firstName,
                lastName,
                shopName,
                businessType,
                description,
                contactPhone,
                contactEmail,
                address,
                city,
                state,
                postalCode,
                country,
                latitude,
                longitude,
                logoUri,
                bannerUri,
                openingTime,
                closingTime,
                activeDays,
                offDays,
                isPickupOnly,
                deliveryRadius,
                preparationTime,
                deliveryFee
            } = req.body;

            if (
                !userId || !firstName || !lastName || !shopName || !businessType ||
                !description || !contactPhone || !contactEmail || !address ||
                !city || !state || !postalCode || !country || !latitude ||
                !longitude || !logoUri
            ) {
                return sendResponse(res, 400, false, 'All fields except bannerUri, offDays, openingTime, closingTime are required for account completion');
            }

            if (!['restaurant', 'grocery'].includes(businessType)) {
                return sendResponse(res, 400, false, 'Invalid businessType. Must be restaurant or grocery');
            }

            const result = await merchantService.registerMerchant(
                userId,
                firstName,
                lastName,
                shopName,
                businessType as 'restaurant' | 'grocery',
                description,
                contactPhone,
                contactEmail,
                address,
                city,
                state,
                postalCode,
                country,
                latitude,
                longitude,
                logoUri,
                bannerUri,
                openingTime,
                closingTime,
                activeDays,
                offDays,
                isPickupOnly,
                deliveryRadius,
                preparationTime,
                deliveryFee
            );
            if (!result.success) return sendResponse(res, 500, false, result.message || 'Failed to register store');

            return sendResponse(res, 201, true, 'Store registered successfully', result.data);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStore(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id as string;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, result.message || 'Error fetching store');
            return sendResponse(res, 200, true, 'Store fetched', result.data);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateStore(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id as string;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const store = await merchantService.updateStore(result.data.id, req.body);
            return sendResponse(res, 200, true, 'Store updated', store);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateStatus(req: AuthRequest, res: Response) {
        try {
            // Support multiple field names for flexibility (status, is_online, or online)
            const status = req.body.status !== undefined ? req.body.status :
                req.body.is_online !== undefined ? req.body.is_online :
                    req.body.online;

            if (status === undefined || status === null) {
                return sendResponse(res, 400, false, 'Status is required');
            }

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const store = await merchantService.updateStatus(result.data.id, status);
            return sendResponse(res, 200, true, 'Store status updated', store);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    // --- Product / Category Extensions (Adding, Deleting and updating) ---
    async getCategories(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const categories = await merchantService.getCategories(result.data.id);
            return sendResponse(res, 200, true, 'Categories fetched', categories);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getCatalog(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const catalog = await merchantService.getCatalog(result.data.id);
            return sendResponse(res, 200, true, 'Catalog fetched', catalog);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async createCategory(req: AuthRequest, res: Response) {
        try {
            const { name, description } = req.body;
            if (!name) return sendResponse(res, 400, false, 'Category name is required');

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const category = await merchantService.createCategory(result.data.id, name, description);
            return sendResponse(res, 201, true, 'Category created', category);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteCategory(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            const success = await merchantService.deleteCategory(result.data.id, req.params.id as string);
            return sendResponse(res, 200, true, 'Category deleted');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateCategory(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            const category = await merchantService.updateCategory(result.data.id, req.params.id as string, req.body);
            return sendResponse(res, 200, true, 'Category updated', category);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async createProduct(req: AuthRequest, res: Response) {
        try {
            const { name, price, category_id, image_url } = req.body;
            if (!name || !price || !category_id) {
                return sendResponse(res, 400, false, 'Name, price, and category_id are required');
            }

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const product = await merchantService.createProduct(result.data.id, req.body);
            return sendResponse(res, 201, true, 'Product created', product);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteProduct(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            await merchantService.deleteProduct(result.data.id, req.params.id as string);
            return sendResponse(res, 200, true, 'Product deleted');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // Usually PUT /merchant/products/:id/availability
    async updateProductAvailability(req: AuthRequest, res: Response) {
        try {
            const { is_available } = req.body;
            if (is_available === undefined) return sendResponse(res, 400, false, 'is_available is required');

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            const product = await merchantService.updateProductAvailability(result.data.id, req.params.id as string, is_available);
            return sendResponse(res, 200, true, 'Product availability updated', product);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // --- Orders ---
    async getOrders(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getOrders(result.data.id, pagination);
            return sendResponse(res, 200, true, 'Orders fetched', formatPaginatedResponse(orders.data, orders.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getOrderById(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id as string;
            const result = await merchantService.getMerchantByUserId(userId);
            const order = await merchantService.getOrderById(result.data.id, req.params.id as string);
            return sendResponse(res, 200, true, 'Order fetched', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateOrderStatus(req: AuthRequest, res: Response) {
        try {
            const { status } = req.body;
            // E.g., handling accept, reject, ready from routes by injecting the status
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            const order = await merchantService.updateOrderStatus(result.data.id, req.params.id as string, status);
            return sendResponse(res, 200, true, `Order status updated to ${status}`, order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
