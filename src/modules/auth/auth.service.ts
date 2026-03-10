import { supabase } from '../../config/supabase';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'Sendo';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

export class AuthService {
    async sendOTP(phone: string): Promise<{ success: boolean; message: string }> {
        // HARDCODED OTP FOR DEVELOPMENT/TESTING
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const { error } = await supabase.from('otps').insert([
            {
                phone,
                otp_code: otpCode,
                expires_at: expiresAt.toISOString(),
            },
        ]);

        if (error) {
            console.error('Error storing OTP:', error);
            return { success: false, message: 'Failed to generate OTP' };
        }

        // Termii Integration (Commented out for development)
        /*
        try {
            if (TERMII_API_KEY) {
                await axios.post(TERMII_URL, {
                    to: phone,
                    from: TERMII_SENDER_ID,
                    sms: `Your Sendo verification code is ${otpCode}. Valid for 10 minutes.`,
                    type: 'plain',
                    channel: 'generic',
                    api_key: TERMII_API_KEY,
                });
                console.log(`[AUTH] OTP sent via Termii to ${phone}`);
            } else {
                console.warn('[AUTH] Missing TERMII_API_KEY. OTP not sent but logged below.');
                console.log(`[AUTH] DEBUG OTP: ${otpCode} for ${phone}`);
            }
        } catch (err: any) {
            console.error('Termii API Error:', err.response?.data || err.message);
            // We still return true if the OTP was stored, so the user can potentially use it if we log it for debug
            // but in production, you might want to return false here.
            return { success: false, message: 'Failed to send SMS via Termii' };
        }
        */

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
        console.log(`[AUTH] DEVELOPMENT MODE: OTP ${otpCode} generated for ${phone}`);
        return { success: true, message: 'OTP sent successfully (Development Mode)' };
    }

    async verifyOTP(phone: string, otpCode: string): Promise<{ success: boolean; message: string; data?: any; token?: string; isNewUser?: boolean; registrationToken?: string }> {
        const { data: otpData, error: otpError } = await supabase
            .from('otps')
            .select('*')
            .eq('phone', phone)
            .eq('otp_code', otpCode)
            .eq('is_verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpData) {
            return { success: false, message: 'Invalid or expired OTP' };
        }

        // Check if user exists
        let { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (userError && userError.code === 'PGRST116') {
            // User doesn't exist, requires registration
            // Do not mark the OTP as verified yet; or we can mark it and issue a short-lived registration token.
            await supabase.from('otps').update({ is_verified: true }).eq('id', otpData.id);

            const registrationToken = jwt.sign(
                { phone, isRegistration: true },
                JWT_SECRET,
                { expiresIn: '15m' } // 15 mins to complete registration
            );

            return { success: true, message: 'OTP correct. New user registration required.', isNewUser: true, registrationToken };
        } else if (userError) {
            console.error('Error fetching user:', userError);
            return { success: false, message: 'Authentication error' };
        } else {
            // User exists, mark OTP as verified
            await supabase.from('otps').update({ is_verified: true }).eq('id', otpData.id);
        }

        // Generate JWT Token for existing user
        const token = jwt.sign(
            {
                id: userData.id,
                phone: userData.phone,
                role: userData.role,
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Fetch sub-profile data if applicable
        let subProfileData = null;
        if (userData.role === 'merchant') {
            const { data: merchant } = await supabase
                .from('merchants')
                .select('*')
                .eq('user_id', userData.id)
                .single();
            subProfileData = merchant;
        } else if (userData.role === 'courier') {
            const { data: courier } = await supabase
                .from('couriers')
                .select('*')
                .eq('user_id', userData.id)
                .single();
            subProfileData = courier;
        }

        return {
            success: true,
            message: 'Authentication successful',
            data: {
                ...userData,
                merchant: userData.role === 'merchant' ? subProfileData : undefined,
                courier: userData.role === 'courier' ? subProfileData : undefined,
            },
            token,
            isNewUser: false
        };
    }

    // --- NEW REGISTRATION METHODS ---

    private verifyRegistrationToken(registrationToken: string): { phone: string } | null {
        try {
            const decoded = jwt.verify(registrationToken, JWT_SECRET) as any;
            if (!decoded.isRegistration || !decoded.phone) return null;
            return { phone: decoded.phone };
        } catch (error) {
            return null;
        }
    }

    private generateAuthToken(userData: any) {
        return jwt.sign(
            {
                id: userData.id,
                phone: userData.phone,
                role: userData.role,
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
    }

    async registerConsumer(registrationToken: string, firstName: string, lastName: string, email?: string): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const decoded = this.verifyRegistrationToken(registrationToken);
        if (!decoded) return { success: false, message: 'Invalid or expired registration token' };

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'consumer' }])
            .select()
            .single();

        if (createError) {
            console.error('Error creating consumer profile:', createError);
            return { success: false, message: `Failed to create consumer: ${createError.message}` };
        }

        return { success: true, message: 'Registration successful', data: newUser, token: this.generateAuthToken(newUser) };
    }

    async registerCourier(registrationToken: string, firstName: string, lastName: string, vehicleType: string, email?: string): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const decoded = this.verifyRegistrationToken(registrationToken);
        if (!decoded) return { success: false, message: 'Invalid or expired registration token' };

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'courier' }])
            .select()
            .single();

        if (createError) {
            console.error('Error creating courier user profile:', createError);
            return { success: false, message: `Failed to create courier user profile: ${createError.message}` };
        }

        // Handle Courier Creation
        const { error: courierError } = await supabase
            .from('couriers')
            .insert([{ user_id: newUser.id, vehicle_type: vehicleType }]);

        if (courierError) console.error('Error creating courier sub-profile:', courierError);

        return { success: true, message: 'Courier registration successful', data: newUser, token: this.generateAuthToken(newUser) };
    }

    async registerMerchant(
        registrationToken: string,
        firstName: string,
        lastName: string,
        storeName: string,
        merchantType: string,
        description?: string,
        address?: string,
        city?: string,
        state?: string,
        postalCode?: string,
        country?: string,
        latitude?: number,
        longitude?: number,
        contactPhone?: string,
        contactEmail?: string,
        logoUri?: string,
        bannerUri?: string,
        openingTime?: string,
        closingTime?: string,
        activeDays: string[] = [],
        offDays?: string[],
        isPickupOnly: boolean = false,
        deliveryRadius: number = 0,
        email?: string
    ): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const decoded = this.verifyRegistrationToken(registrationToken);
        if (!decoded) return { success: false, message: 'Invalid or expired registration token' };

        if (!['restaurant', 'grocery'].includes(merchantType)) {
            return { success: false, message: 'merchantType must be restaurant or grocery' };
        }

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'merchant' }])
            .select()
            .single();

        if (createError) {
            console.error('Error creating merchant user profile:', createError);
            return { success: false, message: `Failed to create merchant user profile: ${createError.message}` };
        }

        // Handle Merchant Creation
        const { data: merchantData, error: merchantError } = await supabase
            .from('merchants')
            .insert([{
                user_id: newUser.id,
                first_name: firstName,
                last_name: lastName,
                name: storeName,
                type: merchantType,
                description,
                phone: contactPhone || decoded.phone,
                contact_email: contactEmail || email,
                address,
                city,
                state,
                postal_code: postalCode,
                country,
                latitude,
                longitude,
                logo_url: logoUri,
                banner_url: bannerUri,
                opening_time: openingTime,
                closing_time: closingTime,
                active_days: activeDays,
                off_days: offDays,
                is_pickup_only: isPickupOnly,
                delivery_radius: deliveryRadius
            }])
            .select()
            .single();

        if (merchantError) {
            console.error('Error creating merchant sub-profile:', merchantError);
            return { success: false, message: `Failed to create merchant profile: ${merchantError.message}` };
        }

        return {
            success: true,
            message: 'Merchant registration successful',
            data: {
                user: newUser,
                merchant: merchantData
            },
            token: this.generateAuthToken(newUser)
        };
    }
}
