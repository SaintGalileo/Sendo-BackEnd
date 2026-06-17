import { Request, Response } from 'express';
import { MerchantOnboardingService } from './merchant.service';
import { OrdersService } from '../orders/orders.service';
import { MerchantEarningsService } from './earnings.service';
import { OrderStatus } from '../../common/constants/orderStatus';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const merchantService = new MerchantOnboardingService();
const ordersService = new OrdersService();
const earningsService = new MerchantEarningsService();
const allowedBusinessTypes = ['restaurant', 'grocery', 'pharmacy', 'store'] as const;

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

            if (!allowedBusinessTypes.includes(businessType)) {
                return sendResponse(res, 400, false, 'Invalid businessType. Must be one of: restaurant, grocery, pharmacy, store');
            }

            const result = await merchantService.registerMerchant(
                userId,
                firstName,
                lastName,
                shopName,
                businessType as 'restaurant' | 'grocery' | 'pharmacy' | 'store',
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
            const { name, price, category_id, image_url, description, is_available, stock_quantity, track_stock } = req.body;
            if (!name || !price || !category_id) {
                return sendResponse(res, 400, false, 'Name, price, and category_id are required');
            }

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const product = await merchantService.createProduct(result.data.id, {
                name,
                description,
                price,
                category_id,
                image_url,
                is_available: is_available !== undefined ? is_available : true,
                stock_quantity: stock_quantity || 0,
                track_stock: track_stock || false
            });
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
            const { status } = req.query;
            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getOrders(result.data.id, pagination, status as string);
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

    async getIncomingOrders(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getIncomingOrders(result.data.id, pagination);
            return sendResponse(
                res,
                200,
                true,
                'Incoming orders fetched',
                formatPaginatedResponse(orders.data, orders.totalCount, pagination.page, pagination.limit)
            );
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getOngoingOrders(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getOngoingOrders(result.data.id, pagination);
            return sendResponse(res, 200, true, 'Ongoing orders fetched', orders.data);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getCompletedOrders(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getCompletedOrders(result.data.id, pagination);
            return sendResponse(res, 200, true, 'Completed orders fetched', orders.data);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getCancelledOrders(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const pagination = getPaginationOptions(req.query);
            const orders = await merchantService.getCancelledOrders(result.data.id, pagination);
            return sendResponse(res, 200, true, 'Cancelled orders fetched', orders.data);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async updateOrderStatus(req: AuthRequest, res: Response) {
        try {
            const { status } = req.body;
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const allowedMerchantStatuses = [
                OrderStatus.ACCEPTED,
                OrderStatus.PREPARING,
                OrderStatus.READY_FOR_PICKUP
            ];

            if (!allowedMerchantStatuses.includes(status)) {
                return sendResponse(res, 400, false, 'Merchants can only set accepted, preparing, or ready_for_pickup');
            }

            await ordersService.updateOrderStatus(result.data.id, req.params.id as string, status);
            const detailedOrder = await merchantService.getOrderById(result.data.id, req.params.id as string);

            return sendResponse(res, 200, true, `Order status updated to ${status}`, detailedOrder);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async acceptOrder(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            await ordersService.acceptOrder(result.data.id, req.params.id as string);
            const detailedOrder = await merchantService.getOrderById(result.data.id, req.params.id as string);
            return sendResponse(res, 200, true, 'Order accepted', detailedOrder);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async declineOrder(req: AuthRequest, res: Response) {
        try {
            const { reason } = req.body;
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const order = await ordersService.declineOrder(result.data.id, req.params.id as string, reason);
            return sendResponse(res, 200, true, 'Order declined', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async prepareOrder(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const result = await merchantService.getMerchantByUserId(req.user.id);
            const order = await ordersService.updateOrderStatus(result.data.id, req.params.id as string, OrderStatus.PREPARING);
            return sendResponse(res, 200, true, 'Order is now being prepared', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async readyForPickupOrder(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const result = await merchantService.getMerchantByUserId(req.user.id);
            const order = await ordersService.updateOrderStatus(result.data.id, req.params.id as string, OrderStatus.READY_FOR_PICKUP);
            return sendResponse(res, 200, true, 'Order is ready for pickup', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async pickUpOrder(req: AuthRequest, res: Response) {
        return sendResponse(res, 403, false, 'Pickup is handled by the assigned courier');
    }

    async onTheWayOrder(req: AuthRequest, res: Response) {
        return sendResponse(res, 403, false, 'On-the-way status is handled by the assigned courier');
    }

    async deliverOrder(req: AuthRequest, res: Response) {
        return sendResponse(res, 403, false, 'Delivery completion is handled by the assigned courier');
    }

    async getEarnings(req: AuthRequest, res: Response) {
        try {
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);
            if (!result.success) return sendResponse(res, 404, false, 'Merchant not found');

            const earnings = await earningsService.getHistory(result.data.id);
            return sendResponse(res, 200, true, 'Earnings fetched', earnings);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    // --- Product Extras (Add-ons) ---
    async createExtraGroup(req: AuthRequest, res: Response) {
        try {
            const { productId } = req.params;
            const { title, is_required, selection_type } = req.body;

            if (!title) return sendResponse(res, 400, false, 'Group title is required');

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);

            const group = await merchantService.createExtraGroup(result.data.id, productId as string, {
                title,
                is_required,
                selection_type
            });

            return sendResponse(res, 201, true, 'Extra group created', group);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteExtraGroup(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);

            await merchantService.deleteExtraGroup(result.data.id, id as string);
            return sendResponse(res, 200, true, 'Extra group deleted');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async addExtraOption(req: AuthRequest, res: Response) {
        try {
            const { groupId } = req.params;
            const { name, price } = req.body;

            if (!name) return sendResponse(res, 400, false, 'Option name is required');

            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);

            const option = await merchantService.addExtraOption(result.data.id, groupId as string, {
                name,
                price
            });

            return sendResponse(res, 201, true, 'Extra option added', option);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async deleteExtraOption(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.id) return sendResponse(res, 401, false, 'Unauthorized');
            const userId = req.user.id;
            const result = await merchantService.getMerchantByUserId(userId);

            await merchantService.deleteExtraOption(result.data.id, id as string);
            return sendResponse(res, 200, true, 'Extra option deleted');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
