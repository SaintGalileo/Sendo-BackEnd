import { Request, Response } from 'express';
import { AdminItemsService } from './admin.items.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { requireCudAudit } from './admin.audit';

const service = new AdminItemsService();

export class AdminItemsController {
    async listItems(req: Request, res: Response) {
        const { search, store_id, module, city, state, zone, page, limit } = req.query;
        const result = await service.listItems({
            search: search as string,
            store_id: store_id as string,
            module: module as string,
            city: city as string,
            state: state as string,
            zone: zone as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getItem(req: Request, res: Response) {
        const result = await service.getItem(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createItem(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.createItem(req.body, { actor: audit.actor, reason: audit.reason });
        return res.status(result.success ? 201 : 400).json(result);
    }

    async bulkCreateItems(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateItems(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async updateItem(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.updateItem(req.params.id as string, req.body, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteItem(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.deleteItem(req.params.id as string, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
