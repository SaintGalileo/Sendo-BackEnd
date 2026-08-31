import { Request, Response } from 'express';
import { AdminCategoriesService } from './admin.categories.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { requireCudAudit } from './admin.audit';

const service = new AdminCategoriesService();

export class AdminCategoriesController {
    async listCategories(req: Request, res: Response) {
        const { page, limit, merchant_id, store_id } = req.query;
        const result = await service.listCategories(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
            (merchant_id || store_id) as string | undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCategory(req: Request, res: Response) {
        const result = await service.getCategory(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createCategory(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.createCategory(req.body, { actor: audit.actor, reason: audit.reason });
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateCategory(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.updateCategory(req.params.id as string, req.body, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCategory(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) return res.status(audit.status).json({ success: false, message: audit.message });
        const result = await service.deleteCategory(req.params.id as string, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
