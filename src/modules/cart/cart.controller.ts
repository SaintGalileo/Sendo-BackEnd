import { Request, Response } from 'express';
import { CartService } from './cart.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';

const cartService = new CartService();

export class CartController {
    async getCart(req: AuthRequest, res: Response) {
        try {
            const cart = await cartService.getCart(req.user.id);
            return sendResponse(res, 200, true, 'Cart fetched successfully', cart);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async addItem(req: AuthRequest, res: Response) {
        try {
            const { productId, quantity, extras } = req.body;
            if (!productId || !quantity) {
                return sendResponse(res, 400, false, 'Product ID and quantity are required');
            }
            const item = await cartService.addItem(req.user.id, productId, quantity, extras);
            return sendResponse(res, 201, true, 'Item added to cart', item);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async updateItem(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { quantity } = req.body;
            if (quantity === undefined) {
                return sendResponse(res, 400, false, 'Quantity is required');
            }
            const item = await cartService.updateItem(req.user?.id as string, id as string, quantity);
            return sendResponse(res, 200, true, 'Cart item updated', item);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async removeItem(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await cartService.removeItem(req.user?.id as string, id as string);
            return sendResponse(res, 200, true, 'Cart item removed');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async clearCart(req: AuthRequest, res: Response) {
        try {
            await cartService.clearCart(req.user.id);
            return sendResponse(res, 200, true, 'Cart cleared successfully');
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
