import { Request, Response } from 'express';
import { ProductsService } from './products.service';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const productsService = new ProductsService();

export class ProductsController {
    async getProduct(req: Request, res: Response) {
        try {
            const product = await productsService.getProductById(req.params.productId as string);
            return sendResponse(res, 200, true, 'Product fetched successfully', product);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getProducts(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const { storeId, q } = req.query;

            const filters = {
                storeId: storeId as string,
                search: q as string, // Search alias
            };

            const result = await productsService.getProducts(filters, pagination);
            return sendResponse(res, 200, true, 'Products fetched successfully', formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
