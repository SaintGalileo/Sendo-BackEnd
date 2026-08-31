import { Request, Response } from 'express';
import { AdminItemsService } from './admin.items.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { actorFromRequest } from './admin.audit';

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
        const actor = actorFromRequest(req.user);
        const reason = req.body?.reason ?? req.body?.change_note ?? 'Product created via admin';
        const result = await service.createItem(
            req.body,
            actor ? { actor, reason } : undefined,
        );
        return res.status(result.success ? 201 : 400).json(result);
    }

    async bulkCreateItems(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateItems(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async updateItem(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        const reason = req.body?.reason ?? req.body?.change_note ?? 'Product updated via admin';
        const result = await service.updateItem(
            req.params.id as string,
            req.body,
            actor ? { actor, reason } : undefined,
        );
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteItem(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteItem(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
