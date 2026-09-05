import { supabase } from './config/supabase';

const TYPE_MAPPING: Record<string, string[]> = {
    restaurant: ['restaurant', 'food_restaurant'],
    grocery: ['grocery', 'supermarket_groceries'],
    pharmacy: ['pharmacy'],
    store: ['store', 'other']
};

async function testFix() {
    console.log('--- Testing Stores Query with Type Mapping and Expanded Status ---');

    for (const clientType of ['restaurant', 'grocery', 'pharmacy', 'store']) {
        const types = TYPE_MAPPING[clientType] || [clientType];
        
        // Filter 1: Strict (verified = true OR verification_status = verified OR status = verified OR status = active)
        let q1 = supabase
            .from('merchants')
            .select('*')
            .in('type', types)
            .or('verified.eq.true,verification_status.eq.verified,status.eq.verified,status.eq.active');

        const { data: d1, error: e1 } = await q1;
        console.log(`[Strict Filter] Type: ${clientType} (mapped to [${types}]): Count = ${d1?.length || 0}`);
        if (d1 && d1.length > 0) {
            console.log(`   Found: ${d1.map(m => m.name).join(', ')}`);
        }

        // Filter 2: Permissive (not inactive and not rejected)
        let q2 = supabase
            .from('merchants')
            .select('*')
            .in('type', types)
            .or('verification_status.neq.rejected,status.neq.inactive');

        const { data: d2, error: e2 } = await q2;
        console.log(`[Permissive Filter] Type: ${clientType} (mapped to [${types}]): Count = ${d2?.length || 0}`);
        if (d2 && d2.length > 0) {
            console.log(`   Found: ${d2.map(m => m.name).join(', ')}`);
        }
    }
}

testFix().catch(console.error);
