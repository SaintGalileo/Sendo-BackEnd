import axios from 'axios';
import dotenv from 'dotenv';
import { SurgeCaps } from './utility.constants';

dotenv.config();

export type SurgeResult = {
    flat: number;
    percent: number;
    score: number;
    reasons: string[];
};

type LatLng = { lat: number; lng: number };

const HARSH_WEATHER_TYPES = new Set([
    'RAIN',
    'HEAVY_RAIN',
    'LIGHT_RAIN',
    'THUNDERSTORM',
    'SNOW',
    'SLEET',
    'HAIL',
    'FOG',
    'TORNADO',
    'HURRICANE',
]);

export class SurgeService {
    private readonly googleMapsApiKey =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        '';

    async computeSurge(origin: LatLng, destination: LatLng, caps: SurgeCaps): Promise<SurgeResult> {
        const empty: SurgeResult = { flat: 0, percent: 0, score: 0, reasons: [] };
        if (!this.googleMapsApiKey || (caps.surge_price <= 0 && caps.surge_percentage <= 0)) {
            return empty;
        }

        const reasons: string[] = [];
        let trafficScore = 0;
        let weatherScore = 0;

        try {
            trafficScore = await this.evaluateTraffic(origin, destination, reasons);
        } catch (error) {
            console.warn('[surge] traffic evaluation failed:', error);
        }

        try {
            weatherScore = await this.evaluateWeather(origin, destination, reasons);
        } catch (error) {
            console.warn('[surge] weather evaluation failed:', error);
        }

        const score = Math.min(1, Math.max(trafficScore, weatherScore));
        if (score <= 0) return empty;

        const flat = Math.round(score * caps.surge_price);
        const percent = Math.round(score * caps.surge_percentage * 100) / 100;

        return { flat, percent, score, reasons };
    }

    applySurge(baseFee: number, surge: SurgeResult): number {
        const percentAmount = baseFee * (surge.percent / 100);
        const total = baseFee + percentAmount + surge.flat;
        return Math.round(total / 100) * 100;
    }

    private async evaluateTraffic(origin: LatLng, destination: LatLng, reasons: string[]): Promise<number> {
        const response = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
                destination: {
                    location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
                },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.googleMapsApiKey,
                    'X-Goog-FieldMask': 'routes.duration,routes.staticDuration',
                },
                timeout: 8000,
            },
        );

        const route = response.data?.routes?.[0];
        if (!route) return 0;

        const durationSec = this.parseDurationSeconds(route.duration);
        const staticDurationSec = this.parseDurationSeconds(route.staticDuration);
        if (!durationSec || !staticDurationSec) return 0;

        const ratio = durationSec / staticDurationSec;
        if (ratio >= 1.4) {
            reasons.push('heavy_traffic');
            return Math.min(1, (ratio - 1) / 0.5);
        }
        if (ratio >= 1.2) {
            reasons.push('moderate_traffic');
            return Math.min(0.6, (ratio - 1) / 0.4);
        }
        return 0;
    }

    private async evaluateWeather(origin: LatLng, destination: LatLng, reasons: string[]): Promise<number> {
        const midpoint = {
            lat: (origin.lat + destination.lat) / 2,
            lng: (origin.lng + destination.lng) / 2,
        };
        const points = [origin, midpoint, destination];
        let maxScore = 0;

        for (const point of points) {
            const score = await this.weatherScoreAt(point, reasons);
            maxScore = Math.max(maxScore, score);
        }

        return maxScore;
    }

    private async weatherScoreAt(point: LatLng, reasons: string[]): Promise<number> {
        const url = 'https://weather.googleapis.com/v1/currentConditions:lookup';
        const response = await axios.get(url, {
            params: {
                'location.latitude': point.lat,
                'location.longitude': point.lng,
                key: this.googleMapsApiKey,
            },
            timeout: 8000,
        });

        const conditionType = String(
            response.data?.weatherCondition?.type ||
                response.data?.weatherCondition?.description?.text ||
                '',
        ).toUpperCase();

        const precipitation = Number(response.data?.precipitation?.qpf?.quantity || 0);
        const isHarsh = HARSH_WEATHER_TYPES.has(conditionType) || precipitation >= 2.5;

        if (isHarsh) {
            if (!reasons.includes('harsh_weather')) reasons.push('harsh_weather');
            return 1;
        }
        if (precipitation > 0 || conditionType.includes('RAIN')) {
            if (!reasons.includes('light_weather')) reasons.push('light_weather');
            return 0.5;
        }
        return 0;
    }

    private parseDurationSeconds(duration: string | undefined): number | null {
        if (!duration || typeof duration !== 'string') return null;
        const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
        if (!match) return null;
        return Number(match[1]);
    }
}
