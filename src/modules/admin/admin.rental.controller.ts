import { Request, Response } from 'express';
import { AdminRentalService } from './admin.rental.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { actorFromRequest } from './admin.audit';

const service = new AdminRentalService();

export class AdminRentalController {
    async getDashboard(_req: Request, res: Response) {
        const result = await service.getDashboard();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async listProviders(_req: Request, res: Response) {
        const result = await service.listProviders();
        return res.status(200).json(result);
    }

    async getProvider(req: Request, res: Response) {
        const result = await service.getProvider(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createProvider(req: AuthRequest, res: Response) {
        const result = await service.createProvider(req.body || {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateProvider(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.updateProvider(req.params.id as string, req.body || {}, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteProvider(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteProvider(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async bulkCreateProviders(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateProviders(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async listVehicles(_req: Request, res: Response) {
        const result = await service.listVehicles();
        return res.status(200).json(result);
    }

    async getVehicle(req: Request, res: Response) {
        const result = await service.getVehicle(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createVehicle(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        const reason = req.body?.reason ?? req.body?.change_note ?? 'Rental vehicle created via admin';
        const result = await service.createVehicle(
            req.body || {},
            actor ? { actor, reason } : undefined,
        );
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateVehicle(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.updateVehicle(req.params.id as string, req.body || {}, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteVehicle(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteVehicle(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async listTrips(req: Request, res: Response) {
        const status = req.query.status as string | undefined;
        const result = await service.listTrips(status);
        return res.status(result.success ? 200 : 500).json(result);
    }
}
