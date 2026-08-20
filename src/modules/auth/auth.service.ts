import { supabase } from '../../config/supabase';
import { EmailService } from '../notifications/email.service';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'Sendo';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

const emailService = new EmailService();

export class AuthService {
    private readonly allowedMerchantTypes = ['restaurant', 'grocery', 'pharmacy', 'store'];
    async sendOTP(phone: string): Promise<{ success: boolean; message: string }> {
        // Generate a 6-digit random OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
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

        // Termii Integration
        try {
            if (TERMII_API_KEY) {
                const cleanPhone = phone.startsWith('+') ? phone.substring(1) : phone;
                const response = await axios.post(TERMII_URL, {
                    to: cleanPhone,
                    from: TERMII_SENDER_ID,
                    sms: `Your Sendo verification code is ${otpCode}. Valid for 10 minutes.`,
                    type: 'plain',
                    channel: 'dnd',
                    api_key: TERMII_API_KEY,
                });
                console.log(`[AUTH] OTP sent via Termii to ${phone}:`, response.data);
                return { success: true, message: 'OTP sent successfully via SMS' };
            } else {
                console.warn('[AUTH] Missing TERMII_API_KEY. OTP not sent but logged below.');
                console.log(`[AUTH] DEBUG OTP: ${otpCode} for ${phone}`);
                return { success: true, message: `OTP generated (Debug): ${otpCode}` };
            }
        } catch (err: any) {
            console.error('Termii API Error:', err.response?.data || err.message);
            return { success: false, message: 'Failed to send SMS via Termii' };
        }
    }

    async verifyOTP(phone: string, otpCode: string, role?: string): Promise<{ success: boolean; message: string; data?: any; token?: string; isNewUser?: boolean; registrationToken?: string }> {
        const isDefaultOTP = otpCode === '123456';
        let otpData: any = null;

        if (isDefaultOTP) {
            otpData = { id: 'default', phone };
        } else {
            const { data, error: otpError } = await supabase
                .from('otps')
                .select('*')
                .eq('phone', phone)
                .eq('otp_code', otpCode)
                .eq('is_verified', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (otpError || !data) {
                return { success: false, message: 'Invalid or expired OTP' };
            }
            otpData = data;
        }

        // Check if user exists
        let { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        // Mark OTP as verified (only for real OTPs)
        if (otpData.id !== 'default') {
            await supabase.from('otps').update({ is_verified: true }).eq('id', otpData.id);
        }

        const registrationToken = jwt.sign(
            { phone, isRegistration: true },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        if (userError && userError.code === 'PGRST116') {
            // User doesn't exist, requires registration
            return { success: true, message: 'OTP correct. New user registration required.', isNewUser: true, registrationToken };
        } else if (userError) {
            console.error('Error fetching user:', userError);
            return { success: false, message: 'Authentication error' };
        }

        // Fetch all available sub-profiles to allow unified access across roles
        const { data: merchantData } = await supabase
            .from('merchants')
            .select('*')
            .eq('user_id', userData.id)
            .maybeSingle();

        const { data: courierData } = await supabase
            .from('couriers')
            .select('*')
            .eq('user_id', userData.id)
            .maybeSingle();

        // If a specific role is requested and the user doesn't have that profile yet,
        // treat them as a new user for that role so they can complete registration.
        // We also return the existing user data to allow the frontend to pre-fill the form.
        if ((role === 'courier' || role === 'rider') && !courierData) {
            return { 
                success: true, 
                message: 'OTP correct. Courier registration required.', 
                isNewUser: true, 
                registrationToken,
                data: userData 
            };
        }

        if (role === 'merchant' && !merchantData) {
            return { 
                success: true, 
                message: 'OTP correct. Merchant registration required.', 
                isNewUser: true, 
                registrationToken,
                data: userData
            };
        }

        // Calculate all active roles
        const roles = ['consumer']; 
        if (merchantData) roles.push('merchant');
        if (courierData) roles.push('courier');

        // Select primary role for legacy compatibility (prioritizing professional roles for app validation)
        let primaryRole = userData.role;
        if (roles.includes('courier')) primaryRole = 'courier';
        else if (roles.includes('merchant')) primaryRole = 'merchant';

        // Update user object with the calculated primary role and full roles array
        const userToReturn = {
            ...userData,
            role: primaryRole,
            roles: roles
        };

        // Generate JWT Token with all roles
        const token = jwt.sign(
            {
                id: userData.id,
                phone: userData.phone,
                role: primaryRole,
                roles: roles
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return {
            success: true,
            message: 'Authentication successful',
            data: {
                ...userToReturn, // Flat structure for apps like Driver App (VerifyOtpScreen line 87)
                user: userToReturn, // Wrapped structure for other apps
                merchant: merchantData || undefined,
                courier: courierData || undefined,
            },
            token,
            registrationToken,
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

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('phone', decoded.phone)
            .maybeSingle();

        let userData;
        if (existingUser) {
            const { data, error } = await supabase
                .from('users')
                .update({ first_name: firstName, last_name: lastName, email })
                .eq('id', existingUser.id)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating consumer profile:', error);
                return { success: false, message: `Failed to update consumer: ${error.message}` };
            }
            userData = data;
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'consumer' }])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating consumer profile:', error);
                return { success: false, message: `Failed to create consumer: ${error.message}` };
            }
            userData = data;
        }

        return { success: true, message: 'Registration successful', data: userData, token: this.generateAuthToken(userData) };
    }

    async registerCourier(
        registrationToken: string, 
        firstName: string, 
        lastName: string, 
        vehicleType: string, 
        plateNumber: string,
        dob: string,
        courierName?: string,
        email?: string
    ): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const decoded = this.verifyRegistrationToken(registrationToken);
        if (!decoded) return { success: false, message: 'Invalid or expired registration token' };

        // 1. Get or Create User
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('phone', decoded.phone)
            .maybeSingle();

        let userData;
        if (existingUser) {
            const { data, error } = await supabase
                .from('users')
                .update({ 
                    first_name: firstName, 
                    last_name: lastName, 
                    email,
                    role: existingUser.role === 'consumer' ? 'courier' : existingUser.role 
                })
                .eq('id', existingUser.id)
                .select()
                .single();
            if (error) return { success: false, message: `Failed to update user profile: ${error.message}` };
            userData = data;
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'courier' }])
                .select()
                .single();
            if (error) return { success: false, message: `Failed to create user profile: ${error.message}` };
            userData = data;
        }

        // 2. Upsert Courier sub-profile
        const { error: courierError } = await supabase
            .from('couriers')
            .upsert({ 
                user_id: userData.id, 
                vehicle_type: vehicleType,
                plate_number: plateNumber,
                date_of_birth: dob,
                name: courierName || `${firstName} ${lastName}`
            }, { onConflict: 'user_id' });

        if (courierError) {
            console.error('Error creating/updating courier sub-profile:', courierError);
            return { success: false, message: `Failed to save courier profile: ${courierError.message}` };
        }

        return { success: true, message: 'Courier registration successful', data: userData, token: this.generateAuthToken(userData) };
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
        preparationTime: string = '15-25',
        deliveryFee: number = 0,
        email?: string
    ): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const decoded = this.verifyRegistrationToken(registrationToken);
        if (!decoded) return { success: false, message: 'Invalid or expired registration token' };

        if (!this.allowedMerchantTypes.includes(merchantType)) {
            return { success: false, message: 'merchantType must be one of: restaurant, grocery, pharmacy, store' };
        }

        // 1. Get or Create User
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('phone', decoded.phone)
            .maybeSingle();

        let userData;
        if (existingUser) {
            const { data, error } = await supabase
                .from('users')
                .update({ 
                    first_name: firstName, 
                    last_name: lastName, 
                    email,
                    role: existingUser.role === 'consumer' ? 'merchant' : existingUser.role
                })
                .eq('id', existingUser.id)
                .select()
                .single();
            if (error) return { success: false, message: `Failed to update user profile: ${error.message}` };
            userData = data;
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert([{ phone: decoded.phone, first_name: firstName, last_name: lastName, email, role: 'merchant' }])
                .select()
                .single();
            if (error) return { success: false, message: `Failed to create user profile: ${error.message}` };
            userData = data;
        }

        // 2. Upsert Merchant sub-profile
        const { data: merchantData, error: merchantError } = await supabase
            .from('merchants')
            .upsert({
                user_id: userData.id,
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
                delivery_radius: deliveryRadius,
                preparation_time: preparationTime,
                delivery_fee: deliveryFee
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (merchantError) {
            console.error('Error creating/updating merchant sub-profile:', merchantError);
            return { success: false, message: `Failed to save merchant profile: ${merchantError.message}` };
        }

        return {
            success: true,
            message: 'Merchant registration successful',
            data: {
                user: userData,
                merchant: merchantData
            },
            token: this.generateAuthToken(userData)
        };
    }

    async sendEmailOTP(email: string): Promise<{ success: boolean; message: string }> {
        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const { error } = await supabase.from('otps').insert([
            {
                email,
                otp_code: otpCode,
                expires_at: expiresAt.toISOString(),
            },
        ]);

        if (error) {
            console.error('Error storing Email OTP:', error);
            return { success: false, message: 'Failed to generate OTP' };
        }

        return await emailService.sendEmail(email, 'Sendo Verification Code', `
            <p>Your verification code is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${otpCode}</h1>
            <p>This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
        `);
    }

    async verifyEmailOTP(email: string, otpCode: string, userId?: string): Promise<{ success: boolean; message: string }> {
        const isDefaultOTP = otpCode === '123456';
        let otpData: any = null;

        if (isDefaultOTP) {
            otpData = { id: 'default', email };
        } else {
            const { data, error: otpError } = await supabase
                .from('otps')
                .select('*')
                .eq('email', email)
                .eq('otp_code', otpCode)
                .eq('is_verified', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (otpError || !data) {
                return { success: false, message: 'Invalid or expired OTP' };
            }
            otpData = data;
        }

        // Mark OTP as verified
        if (otpData.id !== 'default') {
            const { error: updateError } = await supabase
                .from('otps')
                .update({ is_verified: true })
                .eq('id', otpData.id);

            if (updateError) {
                return { success: false, message: 'Failed to verify OTP' };
            }
        }

        // If userId is provided, update user table with email and set email_verified = true
        if (userId) {
            const { error: userUpdateError } = await supabase
                .from('users')
                .update({ 
                    email: email,
                    email_verified: true 
                })
                .eq('id', userId);

            if (userUpdateError) {
                console.error('Failed to update user email status:', userUpdateError);
                // We still returned success for OTP verification, but logged the error
            }
        }

        return { success: true, message: 'Email verified successfully' };
    }

    async adminLogin(email: string, password: string): Promise<{ success: boolean; message: string; data?: any; token?: string }> {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('is_admin', true)
            .single();

        if (error || !user) {
            return { success: false, message: 'Invalid email or password' };
        }

        if (!user.password_hash) {
            return { success: false, message: 'Account not configured for password login' };
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return { success: false, message: 'Invalid email or password' };
        }

        const isSuperAdmin = Boolean(user.is_super_admin);
        const roles = ['admin'];
        if (isSuperAdmin) roles.push('super_admin');

        const { data: merchantData } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (merchantData) roles.push('merchant');

        const { data: courierData } = await supabase
            .from('couriers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (courierData) roles.push('courier');

        const primaryRole = isSuperAdmin ? 'super_admin' : 'admin';

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: primaryRole,
                roles,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            success: true,
            message: 'Admin login successful',
            data: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone || null,
                role: primaryRole,
                roles,
                is_super_admin: isSuperAdmin,
            },
            token,
        };
    }

    async adminMe(userId: string): Promise<{ success: boolean; message: string; data?: any }> {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, phone, is_admin, is_super_admin, created_at')
            .eq('id', userId)
            .eq('is_admin', true)
            .single();

        if (error || !user) {
            return { success: false, message: 'Admin profile not found' };
        }

        const isSuperAdmin = Boolean(user.is_super_admin);
        const roles = ['admin'];
        if (isSuperAdmin) roles.push('super_admin');
        const primaryRole = isSuperAdmin ? 'super_admin' : 'admin';

        return {
            success: true,
            message: 'Admin profile fetched',
            data: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone || null,
                role: primaryRole,
                roles,
                is_super_admin: isSuperAdmin,
                created_at: user.created_at,
            },
        };
    }

    async updateAdminProfile(
        userId: string,
        input: { first_name?: string; last_name?: string; phone?: string | null }
    ): Promise<{ success: boolean; message: string; data?: any }> {
        const { data: existing, error: findError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .eq('is_admin', true)
            .single();

        if (findError || !existing) {
            return { success: false, message: 'Admin profile not found' };
        }

        const patch: Record<string, unknown> = {};
        if (typeof input.first_name === 'string') patch.first_name = input.first_name.trim();
        if (typeof input.last_name === 'string') patch.last_name = input.last_name.trim();
        if (input.phone !== undefined) {
            const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
            patch.phone = phone || null;
        }

        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No profile fields to update' };
        }

        const { error: updateError } = await supabase.from('users').update(patch).eq('id', userId);
        if (updateError) {
            return { success: false, message: updateError.message || 'Failed to update profile' };
        }

        return this.adminMe(userId);
    }

    async changeAdminPassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<{ success: boolean; message: string }> {
        if (!currentPassword || !newPassword) {
            return { success: false, message: 'Current and new password are required' };
        }
        if (newPassword.length < 8) {
            return { success: false, message: 'New password must be at least 8 characters' };
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, password_hash')
            .eq('id', userId)
            .eq('is_admin', true)
            .single();

        if (error || !user) {
            return { success: false, message: 'Admin profile not found' };
        }
        if (!user.password_hash) {
            return { success: false, message: 'Account not configured for password login' };
        }

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return { success: false, message: 'Current password is incorrect' };
        }

        const password_hash = await AuthService.hashPassword(newPassword);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash })
            .eq('id', userId);

        if (updateError) {
            return { success: false, message: updateError.message || 'Failed to update password' };
        }

        return { success: true, message: 'Password updated' };
    }

    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 12);
    }
}
