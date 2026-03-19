import axios from 'axios';

export class LocationService {
    private readonly MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

    /**
     * Calculates the distance between two points in kilometers.
     * Uses Mapbox Matrix API if a token is provided, otherwise falls back to Haversine formula.
     */
    async calculateDistance(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<number> {
        if (this.MAPBOX_TOKEN) {
            try {
                const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?sources=0&destinations=1&annotations=distance&access_token=${this.MAPBOX_TOKEN}`;
                const response = await axios.get(url);
                if (response.data && response.data.distances && response.data.distances[0][0]) {
                    // Mapbox returns distance in meters
                    return response.data.distances[0][0] / 1000;
                }
            } catch (error) {
                console.error('Mapbox API error, falling back to Haversine:', error);
            }
        }

        return this.haversineDistance(origin, destination);
    }

    /**
     * Haversine formula to calculate the great-circle distance between two points.
     * Returns distance in kilometers.
     */
    private haversineDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
        const R = 6371; // Earth's radius in km
        const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
        const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculates the delivery fee based on distance.
     * Pricing:
     * - Base fee: 500 Naira (covers up to 3km)
     * - Additional: 100 Naira per km after the base distance
     */
    calculateDeliveryFee(distanceKm: number): number {
        const baseFee = 500;
        const baseDistance = 3;
        const perKmFee = 100;

        if (distanceKm <= baseDistance) {
            return baseFee;
        }

        const additionalDistance = distanceKm - baseDistance;
        const totalFee = baseFee + (additionalDistance * perKmFee);

        return Math.round(totalFee); // Round to nearest Naira
    }
}
