import { supabase } from '../../config/supabase';

// Real-time tracking integrates heavily with WebSockets/Socket.io usually,
// For REST we just update a location table which can be polled.
export class TrackingService {
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

        if (error) throw new Error(error.message);
        return data;
    }
}
