import { supabase } from './config/supabase';
import { StoresService } from './modules/stores/stores.service';

async function test() {
    console.log('--- Fetching raw merchants from Supabase ---');
    const { data: rawMerchants, error } = await supabase.from('merchants').select('*');
    if (error) {
        console.error('Error fetching raw merchants:', error);
        return;
    }
    console.log(`Total raw merchants count: ${rawMerchants?.length}`);
    if (rawMerchants && rawMerchants.length > 0) {
        console.log('Sample raw merchant:', JSON.stringify(rawMerchants[0], null, 2));
        console.log('Summary of all merchants:');
        rawMerchants.forEach(m => {
            console.log(`- ID: ${m.id} | Name: "${m.name}" | Type: "${m.type}" | Verified: ${m.verified} | Verification Status: "${m.verification_status}" | Lat/Lng: (${m.latitude}, ${m.longitude}) | City: "${m.city}"`);
        });
    }

    console.log('\n--- Testing StoresService.getFeaturedStores ---');
    const service = new StoresService();
    try {
        const featuredRest = await service.getFeaturedStores({ offset: 0, limit: 10 }, undefined, undefined, 'restaurant');
        console.log('Featured Restaurants count:', featuredRest.data.length, 'TotalCount:', featuredRest.totalCount);

        const featuredGrocery = await service.getFeaturedStores({ offset: 0, limit: 10 }, undefined, undefined, 'grocery');
        console.log('Featured Groceries count:', featuredGrocery.data.length);

        const featuredPharmacy = await service.getFeaturedStores({ offset: 0, limit: 10 }, undefined, undefined, 'pharmacy');
        console.log('Featured Pharmacy count:', featuredPharmacy.data.length);

        const featuredStore = await service.getFeaturedStores({ offset: 0, limit: 10 }, undefined, undefined, 'store');
        console.log('Featured Store count:', featuredStore.data.length);

        console.log('\n--- Testing with sample Lat/Lng (e.g. Lagos / Abuja / current location) ---');
        if (rawMerchants && rawMerchants.length > 0 && rawMerchants[0].latitude) {
            const sampleLat = rawMerchants[0].latitude.toString();
            const sampleLng = rawMerchants[0].longitude.toString();
            console.log(`Testing distance filter with coords (${sampleLat}, ${sampleLng})`);
            const featuredWithCoords = await service.getFeaturedStores({ offset: 0, limit: 10 }, sampleLat, sampleLng, 'restaurant');
            console.log('Featured Restaurants with coords count:', featuredWithCoords.data.length);
        }
    } catch (err) {
        console.error('Error in StoresService:', err);
    }
}

test().catch(console.error);
