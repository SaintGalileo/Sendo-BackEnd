import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { AuthService } from './auth.service';
import { clientMetaFromRequest } from '../../common/utils/requestMeta';

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
        const { phone, otpCode, role } = req.body || {};

        if (!phone || !otpCode) {
            return res.status(400).json({
                success: false,
                message: 'Phone and OTP code are required',
            });
        }

        const result = await authService.verifyOTP(phone, otpCode, role);
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
        const { registrationToken, firstName, lastName, vehicleType, plateNumber, dob, courierName, email } = req.body || {};

        if (!registrationToken || !firstName || !lastName || !vehicleType || !plateNumber || !dob) {
            return res.status(400).json({ 
                success: false, 
                message: 'registrationToken, firstName, lastName, vehicleType, plateNumber, and dob are required' 
            });
        }

        const result = await authService.registerCourier(
            registrationToken, 
            firstName, 
            lastName, 
            vehicleType, 
            plateNumber, 
            dob, 
            courierName, 
            email
        );
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

        if (!openingTime || !closingTime) {
            return res.status(400).json({ success: false, message: 'openingTime and closingTime are required' });
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

    async adminLogin(req: Request, res: Response) {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const result = await authService.adminLogin(email, password, clientMetaFromRequest(req));
        return res.status(result.success ? 200 : 401).json(result);
    }

    async adminLogout(req: AuthRequest, res: Response) {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const result = await authService.adminLogout(req.user, clientMetaFromRequest(req));
        return res.status(result.success ? 200 : 401).json(result);
    }

    async adminMe(req: AuthRequest, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const result = await authService.adminMe(userId);
        return res.status(result.success ? 200 : 404).json(result);
    }

    async updateAdminProfile(req: AuthRequest, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const { first_name, last_name, phone } = req.body || {};
        const result = await authService.updateAdminProfile(userId, { first_name, last_name, phone });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async changeAdminPassword(req: AuthRequest, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const { currentPassword, newPassword } = req.body || {};
        const result = await authService.changeAdminPassword(userId, currentPassword, newPassword);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async requestAdminPasswordReset(req: Request, res: Response) {
        const { email } = req.body || {};
        const result = await authService.requestAdminPasswordReset(email);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async confirmAdminPasswordReset(req: Request, res: Response) {
        const { email, token, newPassword, password } = req.body || {};
        const result = await authService.confirmAdminPasswordReset(
            email,
            token,
            newPassword || password,
        );
        return res.status(result.success ? 200 : 400).json(result);
    }

    async registerAdmin(req: Request, res: Response) {
        const { firstName, first_name, lastName, last_name, email, password } = req.body || {};
        const result = await authService.registerAdmin(
            firstName || first_name,
            lastName || last_name,
            email,
            password,
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
