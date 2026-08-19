import { Request, Response } from 'express';
import { AdminTransactionsService } from './admin.transactions.service';

const service = new AdminTransactionsService();

export class AdminTransactionsController {
    async getTransactionReport(req: Request, res: Response) {
        const { dateFrom, dateTo } = req.query;
        const result = await service.getTransactionReport(
            dateFrom as string,
            dateTo as string
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getWithdrawRequests(req: Request, res: Response) {
        const type = req.params.type as 'store' | 'courier';
        const { page, limit } = req.query;
        const result = await service.getWithdrawRequests(
            type,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined
        );
        return res.json(result);
    }
}
