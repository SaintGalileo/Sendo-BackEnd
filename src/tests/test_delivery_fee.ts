import dotenv from 'dotenv';
import { LocationService } from '../modules/orders/location.service';

dotenv.config();

const locationService = new LocationService();

async function testDistance() {
    // Sample coordinates (Lagos)
    const merchant = { lat: 6.4547, lng: 3.3888 }; // Marina
    const consumer = { lat: 6.5244, lng: 3.3792 }; // Ikeja (approx)

    console.log('Testing Distance Calculation...');
    const distanceKm = await locationService.calculateDistance(merchant, consumer);
    console.log(`- Distance: ${distanceKm.toFixed(2)} km`);

    const fee = locationService.calculateDeliveryFee(distanceKm);
    console.log(`- Calculated Fee: ${fee} NGN`);

    // Verify logic
    // 6371 * acos(sin(6.4547*pi/180)*sin(6.5244*pi/180) + cos(6.4547*pi/180)*cos(6.5244*pi/180)*cos((3.3792-3.3888)*pi/180)) 
    // approx 7-8 km
    
    if (distanceKm > 0 && fee >= 500) {
        console.log('SUCCESS: Distance and fee logic operational.');
    } else {
        console.error('FAILURE: Invalid distance or fee.');
    }
}

testDistance();
