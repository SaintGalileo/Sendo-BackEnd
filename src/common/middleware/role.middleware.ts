import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const roleMiddleware = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Support both unified 'roles' array and legacy 'role' string
        const userRoles = req.user.roles || [req.user.role];
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};
