import { Request, Response } from 'express';
import { AdminStoresService } from './admin.stores.service';

const service = new AdminStoresService();

export class AdminStoresController {
    async listStores(req: Request, res: Response) {
        const { search, type, status, module, city, state, zone, page, limit } = req.query;
        const result = await service.listStores({
            search: search as string,
            type: type as string,
            status: status as string,
            module: module as string,
            city: city as string,
            state: state as string,
            zone: zone as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getStore(req: Request, res: Response) {
        const result = await service.getStore(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async updateStoreStatus(req: Request, res: Response) {
        const { status, reason, rejection_reason } = req.body || {};
        if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
        const result = await service.updateStoreStatus(
            req.params.id as string,
            status,
            reason ?? rejection_reason,
        );
        return res.status(result.success ? 200 : 400).json(result);
    }

    async createStore(req: Request, res: Response) {
        const body = req.body || {};
        const result = await service.createStore({
            name: body.name,
            type: body.type,
            owner_name: body.owner_name,
            first_name: body.first_name,
            last_name: body.last_name,
            status: body.status,
            phone: body.phone,
            email: body.email,
            address: body.address,
            city: body.city,
            state: body.state,
            postal_code: body.postal_code,
            country: body.country,
            latitude: body.latitude,
            longitude: body.longitude,
            logo_url: body.logo_url,
            banner_url: body.banner_url,
            description: body.description,
        });
        return res.status(result.success ? 201 : 400).json(result);
    }

    async bulkCreateStores(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateStores(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
