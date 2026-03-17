import { supabase } from './src/config/supabase';
import dotenv from 'dotenv';
dotenv.config();

const checkSchema = async () => {
    try {
        // Try to select one row and see the keys
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching product:', error);
        } else if (data && data.length > 0) {
            console.log('Columns in products table:', Object.keys(data[0]));
        } else {
            console.log('No products found to infer schema.');
            // Fallback: try to insert a dummy product to see column names or just assume
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

checkSchema();
