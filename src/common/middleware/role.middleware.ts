import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const roleMiddleware = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Support both unified 'roles' array and legacy 'role' string
        const userRoles: string[] = Array.isArray(req.user.roles)
            ? req.user.roles
            : [req.user.role].filter(Boolean);
        // Super-admin always satisfies an "admin" requirement.
        if (userRoles.includes('super_admin') && !userRoles.includes('admin')) {
            userRoles.push('admin');
        }
        const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};
