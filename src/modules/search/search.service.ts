import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';

const storesService = new StoresService();
const productsService = new ProductsService();

export class SearchService {
    async search(query: string, pagination: any) {
        const filters = { search: query };
        
        // Parallel search for stores and products
        const [storesResult, productsResult] = await Promise.all([
            storesService.getStores(filters, pagination),
            productsService.getProducts(filters, pagination)
        ]);

        return {
            stores: storesResult.data,
            products: productsResult.data,
            totalStores: storesResult.totalCount,
            totalProducts: productsResult.totalCount
        };
    }
}
