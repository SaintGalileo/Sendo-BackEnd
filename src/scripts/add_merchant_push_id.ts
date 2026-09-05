import { supabase } from '../config/supabase';

async function runMigration() {
    console.log('[MIGRATION] Checking push_id column on merchants table...');

    try {
        // Test selecting push_id to verify if column already exists
        const { data, error } = await supabase
            .from('merchants')
            .select('id, name, push_id')
            .limit(1);

        if (error) {
            console.warn('[MIGRATION] push_id column check returned:', error.message);
            console.log('\nPlease run the SQL migration on your Supabase SQL Editor:');
            console.log(`
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS push_id TEXT;

CREATE INDEX IF NOT EXISTS idx_merchants_push_id ON public.merchants (push_id);

NOTIFY pgrst, 'reload schema';
            `);
        } else {
            console.log('✅ push_id column is active and accessible on merchants table!');
        }
    } catch (err: any) {
        console.error('[MIGRATION] Error:', err.message);
    }
}

runMigration().catch(console.error);
