import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';

const storesService = new StoresService();
const productsService = new ProductsService();

export class SearchService {
    async search(
        query: string,
        pagination: any,
        lat?: string,
        lng?: string,
        manualLoc?: { state?: string; city?: string; area?: string; country?: string },
    ) {
        const filters: Record<string, string | undefined> = { search: query };
        if (manualLoc?.state) filters.state = manualLoc.state;
        if (manualLoc?.city) filters.city = manualLoc.city;
        if (manualLoc?.area) filters.area = manualLoc.area;
        if (manualLoc?.country) filters.country = manualLoc.country;
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
