import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
    async sendOTP(req: Request, res: Response) {
        const { phone } = req.body || {};

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const result = await authService.sendOTP(phone);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async verifyOTP(req: Request, res: Response) {
        const { phone, otpCode } = req.body || {};

        if (!phone || !otpCode) {
            return res.status(400).json({
                success: false,
                message: 'Phone and OTP code are required',
            });
        }

        const result = await authService.verifyOTP(phone, otpCode);
        return res.status(result.success ? 200 : 401).json(result);
    }

    async registerConsumer(req: Request, res: Response) {
        const { registrationToken, firstName, lastName, email } = req.body || {};

        if (!registrationToken || !firstName || !lastName) {
            return res.status(400).json({ success: false, message: 'registrationToken, firstName, and lastName are required' });
        }

        const result = await authService.registerConsumer(registrationToken, firstName, lastName, email);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async registerCourier(req: Request, res: Response) {
        const { registrationToken, firstName, lastName, vehicleType, email } = req.body || {};

        if (!registrationToken || !firstName || !lastName || !vehicleType) {
            return res.status(400).json({ success: false, message: 'registrationToken, firstName, lastName, and vehicleType are required' });
        }

        const result = await authService.registerCourier(registrationToken, firstName, lastName, vehicleType, email);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async registerMerchant(req: Request, res: Response) {
        const {
            registrationToken,
            firstName,
            lastName,
            storeName,
            merchantType,
            description,
            address,
            city,
            state,
            postalCode,
            country,
            latitude,
            longitude,
            contactPhone,
            contactEmail,
            logoUri,
            bannerUri,
            openingTime,
            closingTime,
            activeDays,
            offDays,
            isPickupOnly,
            deliveryRadius,
            preparationTime,
            deliveryFee,
            email // This is for the user account email
        } = req.body || {};

        if (!registrationToken || !firstName || !lastName || !storeName || !merchantType) {
            return res.status(400).json({ success: false, message: 'registrationToken, firstName, lastName, storeName, and merchantType are required' });
        }

        const result = await authService.registerMerchant(
            registrationToken,
            firstName,
            lastName,
            storeName,
            merchantType,
            description,
            address,
            city,
            state,
            postalCode,
            country,
            latitude,
            longitude,
            contactPhone,
            contactEmail,
            logoUri,
            bannerUri,
            openingTime,
            closingTime,
            activeDays,
            offDays,
            isPickupOnly,
            deliveryRadius,
            preparationTime,
            deliveryFee,
            email
        );
        return res.status(result.success ? 201 : 400).json(result);
    }

    async sendEmailOTP(req: Request, res: Response) {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const result = await authService.sendEmailOTP(email);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async verifyEmailOTP(req: AuthRequest, res: Response) {
        const { email, otpCode } = req.body || {};

        if (!email || !otpCode) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP code are required',
            });
        }

        const result = await authService.verifyEmailOTP(email, otpCode, req.user?.id);
        return res.status(result.success ? 200 : 401).json(result);
    }
}
