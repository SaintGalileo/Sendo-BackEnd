import { Request, Response } from 'express';
import { AdminCategoriesService } from './admin.categories.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { actorFromRequest } from './admin.audit';

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
        const actor = actorFromRequest(req.user);
        const reason = req.body?.reason ?? req.body?.change_note ?? 'Category created via admin';
        const result = await service.createCategory(
            req.body,
            actor ? { actor, reason } : undefined,
        );
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateCategory(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        const reason = req.body?.reason ?? req.body?.change_note ?? 'Category updated via admin';
        const result = await service.updateCategory(
            req.params.id as string,
            req.body,
            actor ? { actor, reason } : undefined,
        );
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCategory(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteCategory(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
