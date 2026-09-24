import axios from 'axios';
import dotenv from 'dotenv';
import { haversineDistanceKm } from '../../common/utils/geo.util';

dotenv.config();

export class LocationService {
    private readonly googleMapsApiKey =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        '';

    /**
     * Calculates the distance between two points in kilometers.
     * Uses Google Distance Matrix API for accurate road distance.
     */
    async calculateDistance(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<number> {
        if (this.googleMapsApiKey) {
            try {
                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${this.googleMapsApiKey}`;
                const response = await axios.get(url);

                if (response.data && response.data.rows?.[0]?.elements?.[0]?.status === 'OK') {
                    const element = response.data.rows[0].elements[0];
                    // Google returns distance in meters
                    return element.distance.value / 1000;
                }

                console.warn('Google Distance Matrix status not OK, falling back to Haversine');
            } catch (error) {
                console.error('Google Distance Matrix API error, falling back to Haversine:', error);
            }
        }

        return haversineDistanceKm(origin, destination);
    }

    /**
     * Calculates the delivery fee based on distance.
     * Pricing:
     * - Base fee: 1000 Naira (covers up to 3km)
     * - Additional: 200 Naira per km after the base distance
     */
    calculateDeliveryFee(distanceKm: number): number {
        const baseFee = 1000;
        const baseDistance = 3;
        const perKmFee = 200;

        if (distanceKm <= baseDistance) {
            return baseFee;
        }

        const additionalDistance = distanceKm - baseDistance;
        const totalFee = baseFee + (additionalDistance * perKmFee);

        // Round to nearest hundred (e.g., 2300, 2500)
        return Math.round(totalFee / 100) * 100;
    }
}
