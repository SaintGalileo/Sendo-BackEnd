import { Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { requireCudAudit } from './admin.audit';
import { UtilityService } from '../utility/utility.service';

const service = new UtilityService();

export class AdminUtilityController {
    async getUtility(_req: AuthRequest, res: Response) {
        const result = await service.getAll();
        return res.status(200).json(result);
    }

    async updateUtility(req: AuthRequest, res: Response) {
        const audit = requireCudAudit(req.user, req.body);
        if (!audit.ok) {
            return res.status(audit.status).json({ success: false, message: audit.message });
        }

        const result = await service.updateMany(req.body || {}, {
            actor: audit.actor,
            reason: audit.reason,
        });
        return res.status(result.success ? 200 : 400).json(result);
    }
}
