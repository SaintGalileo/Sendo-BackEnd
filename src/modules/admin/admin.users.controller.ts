import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { AdminUsersService } from './admin.users.service';
import { actorFromRequest } from './admin.audit';

const service = new AdminUsersService();

export class AdminUsersController {
    async listCustomers(req: Request, res: Response) {
        const { search, page, limit, city, state, zone } = req.query;
        const result = await service.listCustomers({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            city: city as string | undefined,
            state: state as string | undefined,
            zone: zone as string | undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCustomer(req: Request, res: Response) {
        const result = await service.getCustomer(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async updateCustomer(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.updateCustomer(req.params.id as string, req.body || {}, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCustomer(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteCustomer(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async listCouriers(req: Request, res: Response) {
        const { search, page, limit, online } = req.query;
        const result = await service.listCouriers({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            online: online !== undefined ? online === 'true' : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCourier(req: Request, res: Response) {
        const result = await service.getCourier(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async updateCourier(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.updateCourier(req.params.id as string, req.body || {}, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCourier(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteCourier(req.params.id as string, { actor, reason });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async createCourier(req: Request, res: Response) {
        const body = req.body || {};
        const result = await service.createCourier({
            first_name: body.first_name,
            last_name: body.last_name,
            email: body.email,
            phone: body.phone,
            vehicle_type: body.vehicle_type,
            plate_number: body.plate_number,
        });
        return res.status(result.success ? 201 : 400).json(result);
    }

    async listMerchants(req: Request, res: Response) {
        const { search, page, limit } = req.query;
        const result = await service.listMerchants({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getUsersOverview(req: Request, res: Response) {
        try {
            const { city, state, zone } = req.query;
            const result = await service.getUsersOverview({
                city: city as string | undefined,
                state: state as string | undefined,
                zone: zone as string | undefined,
            });
            return res.json(result);
        } catch (err: any) {
            return res.status(500).json({
                success: false,
                message: err?.message || 'Failed to load users overview',
                data: null,
            });
        }
    }

    async listEmployees(req: Request, res: Response) {
        const { search, page, limit } = req.query;
        const result = await service.listEmployees({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getEmployee(req: Request, res: Response) {
        const result = await service.getEmployee(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createEmployee(req: Request, res: Response) {
        const { email, password, first_name, last_name, phone, avatar_url } = req.body || {};
        const result = await service.createEmployee({
            email,
            password,
            first_name,
            last_name,
            phone,
            avatar_url,
        });
        if (!result.success) {
            const status = result.message?.includes('already exists') ? 409 : 400;
            return res.status(status).json(result);
        }
        return res.status(201).json(result);
    }

    async updateEmployee(req: Request, res: Response) {
        const result = await service.updateEmployee(req.params.id as string, req.body || {});
        if (!result.success) {
            const status = result.message === 'Employee not found' ? 404 : 400;
            return res.status(status).json(result);
        }
        return res.json(result);
    }

    async updateEmployeeStatus(req: AuthRequest, res: Response) {
        const active = Boolean(req.body?.active);
        const actorId = req.user?.id as string;
        if (!actorId) {
            return res.status(401).json({ success: false, message: 'Unauthorized', data: null });
        }
        const result = await service.updateEmployeeStatus(req.params.id as string, active, actorId);
        if (!result.success) {
            const status =
                result.message === 'Employee not found'
                    ? 404
                    : result.message?.includes('last remaining') || result.message?.includes('own account')
                      ? 403
                      : 400;
            return res.status(status).json(result);
        }
        return res.json(result);
    }

    async resetEmployeePassword(req: Request, res: Response) {
        const result = await service.sendEmployeePasswordReset(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteEmployee(req: AuthRequest, res: Response) {
        const actor = actorFromRequest(req.user);
        if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const reason = req.body?.reason ?? req.body?.change_note;
        const result = await service.deleteEmployee(req.params.id as string, actor.id, { actor, reason });
        if (!result.success) {
            const status =
                result.message === 'Employee not found'
                    ? 404
                    : result.message?.includes('last remaining') || result.message?.includes('own account')
                      ? 403
                      : 400;
            return res.status(status).json(result);
        }
        return res.json(result);
    }
}
