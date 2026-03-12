import { ProductsService } from './src/modules/products/products.service';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    const s = new ProductsService();
    try {
        const prod = await s.getProductById('bf40be75-73d6-4f13-9140-e23479449ac8');
        console.log(JSON.stringify(prod, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

test();
