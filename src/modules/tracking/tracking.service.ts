import { supabase } from '../../config/supabase';

// Real-time tracking integrates heavily with WebSockets/Socket.io usually,
// For REST we just update a location table which can be polled.
export class TrackingService {
    private isCourierLocationsTableMissing(error: any): boolean {
        if (!error) return false;
        const message = `${error.message || ''}`.toLowerCase();
        return error.code === '42P01' || error.code === 'PGRST205' || message.includes('courier_locations');
    }

    async updateCourierLocation(userId: string, lat: number, lng: number) {
        // Fetch courier profile id
        const { data: profile, error: pError } = await supabase
            .from('couriers')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (pError || !profile) throw new Error('Courier profile not found');

        const { data, error } = await supabase
            .from('courier_locations')
            .upsert({
                courier_id: profile.id,
                lat,
                lng,
                updated_at: new Date().toISOString()
            }, { onConflict: 'courier_id' })
            .select()
            .single();

        if (error) {
            if (this.isCourierLocationsTableMissing(error)) {
                console.warn('[TrackingService] courier_locations table missing; returning synthetic location response.');
                return {
                    courier_id: profile.id,
                    lat,
                    lng,
                    updated_at: new Date().toISOString(),
                    fallback: true
                };
            }

            throw new Error(error.message);
        }
        return data;
    }
}
