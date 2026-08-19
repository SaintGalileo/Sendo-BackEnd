import { Request, Response } from 'express';
import { AdminCategoriesService } from './admin.categories.service';

const service = new AdminCategoriesService();

export class AdminCategoriesController {
    async listCategories(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listCategories(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async createCategory(req: Request, res: Response) {
        const result = await service.createCategory(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateCategory(req: Request, res: Response) {
        const result = await service.updateCategory(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCategory(req: Request, res: Response) {
        const result = await service.deleteCategory(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
