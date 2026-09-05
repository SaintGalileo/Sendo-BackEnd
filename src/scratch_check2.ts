import { supabase } from './config/supabase';

async function checkAll() {
    const { data, error } = await supabase.from('merchants').select('*');
    if (error) {
        console.error(error);
        return;
    }
    data.forEach(m => {
        console.log(`Name: ${m.name}`);
        console.log(`  Type: ${m.type}`);
        console.log(`  verified: ${m.verified}`);
        console.log(`  verification_status: ${m.verification_status}`);
        console.log(`  status: ${m.status}`);
        console.log(`  is_active: ${m.is_active}`);
        console.log(`  is_online: ${m.is_online}`);
        console.log('---');
    });
}

checkAll().catch(console.error);
