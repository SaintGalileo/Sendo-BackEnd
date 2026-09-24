import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';

const storesService = new StoresService();
const productsService = new ProductsService();

export class SearchService {
    async search(query: string, pagination: any, lat?: string, lng?: string) {
        const filters: Record<string, string | undefined> = { search: query };
        if (lat && lng) {
            filters.lat = lat;
            filters.lng = lng;
        }

        const [storesResult, productsResult] = await Promise.all([
            storesService.getStores(filters, pagination),
            productsService.getProducts({ search: query }, pagination),
        ]);

        return {
            stores: storesResult.data,
            products: productsResult.data,
            totalStores: storesResult.totalCount,
            totalProducts: productsResult.totalCount,
        };
    }
}
