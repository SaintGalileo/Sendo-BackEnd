import assert from 'assert';
import dotenv from 'dotenv';
import { locationService } from '../modules/orders/location.service';

dotenv.config();

async function testDistance() {
    // 1. Single-leg fee & courier earning assertions
    assert.strictEqual(locationService.calculateDeliveryFee(2.5), 1000, '<= 3km should be ₦1,000');
    assert.strictEqual(locationService.calculateCourierEarning(1000), 800, '80% of ₦1,000 should be ₦800');
    assert.strictEqual(locationService.calculateDeliveryFee(7), 1800, '7km should be ₦1,800');
    assert.strictEqual(locationService.calculateCourierEarning(1800), 1440, '80% of ₦1,800 should be ₦1,440');

    // 2. Two-leg trip (courier -> merchant -> customer in Lagos)
    const courier = { lat: 6.4969, lng: 3.3553 }; // Surulere
    const merchant = { lat: 6.4547, lng: 3.3888 }; // Marina
    const consumer = { lat: 6.5244, lng: 3.3792 }; // Ikeja

    console.log('Testing Two-Leg Distance Calculation...');
    const twoLeg = await locationService.calculateTwoLegTrip(courier, merchant, consumer);
    console.log('- Two-Leg Result:', twoLeg);

    assert.strictEqual(twoLeg.includesPickupLeg, true, 'Two-leg trip should include pickup leg');
    assert.ok(twoLeg.pickupDistanceKm > 0, 'Pickup leg distance should be > 0');
    assert.ok(twoLeg.dropoffDistanceKm > 0, 'Dropoff leg distance should be > 0');
    assert.ok(
        Math.abs(twoLeg.totalDistanceKm - (twoLeg.pickupDistanceKm + twoLeg.dropoffDistanceKm)) <= 0.02,
        'Total distance should equal pickup + dropoff',
    );
    assert.ok(twoLeg.fee >= 1000, 'Fee should be at least ₦1,000');
    assert.strictEqual(
        twoLeg.courierEarning,
        Math.round(twoLeg.fee * 0.8 * 100) / 100,
        'Courier earning should be 80% of total fee',
    );

    // 3. Null courier location fallback (merchant -> customer only)
    const singleLeg = await locationService.calculateTwoLegTrip(null, merchant, consumer);
    console.log('- Null Courier Fallback Result:', singleLeg);

    assert.strictEqual(singleLeg.includesPickupLeg, false, 'Fallback should not include pickup leg');
    assert.strictEqual(singleLeg.pickupDistanceKm, 0, 'Fallback pickup distance should be 0');
    assert.ok(singleLeg.fee <= twoLeg.fee, 'Single-leg fee should be <= two-leg fee');

    console.log('SUCCESS: All single-leg, two-leg, and fallback fee assertions passed.');
}

testDistance().catch((err) => {
    console.error('FAILURE:', err);
    process.exit(1);
});
