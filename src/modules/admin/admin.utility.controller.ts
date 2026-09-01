import { Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { requireCudAudit } from './admin.audit';
import { UtilityService } from '../utility/utility.service';

const service = new UtilityService();

export class AdminUtilityController {
    async getContacts(_req: AuthRequest, res: Response) {
        const result = await service.getContactsAdmin();
        return res.status(200).json(result);
    }

    async updateContacts(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) {
            return res.status(audit.status).json({ success: false, message: audit.message });
        }

        const result = await service.updateContacts(req.body || {}, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getSurgePricing(_req: AuthRequest, res: Response) {
        const result = await service.getSurgeAdmin();
        return res.status(200).json(result);
    }

    async updateSurgePricing(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) {
            return res.status(audit.status).json({ success: false, message: audit.message });
        }

        const result = await service.updateSurgePricing(req.body || {}, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
