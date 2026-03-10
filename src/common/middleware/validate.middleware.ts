import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map((detail: any) => detail.message);
            return res.status(400).json({ success: false, message: 'Validation error', errors });
        }
        next();
    };
};
