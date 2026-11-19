import { supabase } from '../config/supabase';

async function runMigration() {
    console.log('[MIGRATION] Checking push_id column on couriers table...');

    try {
        // Test selecting push_id to verify if column already exists
        const { data, error } = await supabase
            .from('couriers')
            .select('id, push_id')
            .limit(1);

        if (error) {
            console.warn('[MIGRATION] push_id column check returned:', error.message);
            console.log('\nPlease run the following SQL on your Supabase SQL Editor:');
            console.log(`
ALTER TABLE public.couriers 
ADD COLUMN IF NOT EXISTS push_id TEXT;

CREATE INDEX IF NOT EXISTS idx_couriers_push_id ON public.couriers (push_id);

NOTIFY pgrst, 'reload schema';
            `);
        } else {
            console.log('✅ push_id column is active and accessible on couriers table!');
        }
    } catch (err: any) {
        console.error('[MIGRATION] Error:', err.message);
    }
}

runMigration().catch(console.error);
