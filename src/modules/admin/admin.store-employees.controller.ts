import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { actorFromRequest } from './admin.audit';
import { AdminAuditService, AdminStoreEmployeesService } from './admin.store-employees.service';

const service = new AdminStoreEmployeesService();
const auditService = new AdminAuditService();

export class AdminStoreEmployeesController {
    async list(req: Request, res: Response) {
        const { merchant_id, store_id, search, page, limit } = req.query;
        const result = await service.list({
            merchant_id: (merchant_id || store_id) as string | undefined,
            search: search as string | undefined,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async get(req: Request, res: Response) {
        const result = await service.get(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async create(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.create(req.body || {}, { actor, reason });
        return res.status(result.success ? 201 : 400).json(result);
    }

    async update(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.update(req.params.id as string, req.body || {}, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async delete(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.delete(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }
}

export class AdminAuditController {
    async list(req: Request, res: Response) {
        const { page, limit, entity_type, action, actor_id, search } = req.query;
        const result = await auditService.list({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            entity_type: entity_type as string | undefined,
            action: action as string | undefined,
            actor_id: actor_id as string | undefined,
            search: search as string | undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }
}
