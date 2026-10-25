import { supabase } from '../config/supabase';

async function runMigration() {
    console.log('[MIGRATION] Checking order verification code columns on orders table...');

    try {
        // Test selecting columns to verify if they exist
        const { data, error } = await supabase
            .from('orders')
            .select('id, pickup_code, delivery_code, driver_pickup_code')
            .limit(1);

        if (error) {
            console.warn('[MIGRATION] Verification code columns check returned:', error.message);
            console.log('\n========================================================');
            console.log('Please run the following SQL migration in your Supabase SQL Editor:');
            console.log('========================================================\n');
            console.log(`
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS driver_pickup_code VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON public.orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_code ON public.orders(delivery_code);
CREATE INDEX IF NOT EXISTS idx_orders_driver_pickup_code ON public.orders(driver_pickup_code);

COMMENT ON COLUMN public.orders.pickup_code IS '4-digit verification code shown to user for pickup orders. Entered by vendor to complete the order.';
COMMENT ON COLUMN public.orders.delivery_code IS '4-digit verification code shown to user for delivery orders. Entered by rider to complete delivery.';
COMMENT ON COLUMN public.orders.driver_pickup_code IS '4-digit claim code shown to rider for delivery orders. Given to vendor to claim the package.';

NOTIFY pgrst, 'reload schema';
            `);
            console.log('========================================================\n');
        } else {
            console.log('✅ Order verification code columns (pickup_code, delivery_code, driver_pickup_code) are active and accessible on orders table!');
        }
    } catch (err: any) {
        console.error('[MIGRATION] Error:', err.message);
    }
}

runMigration().catch(console.error);
