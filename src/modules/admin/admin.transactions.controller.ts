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

    async getAccountTransactions(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status, search } = req.query;
        const result = await service.getAccountTransactions({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            status: status as string,
            search: search as string,
        });
        return res.json(result);
    }

    async getStoreWithdrawals(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status } = req.query;
        const result = await service.getStoreWithdrawals({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            status: status as string,
        });
        return res.json(result);
    }

    async getCourierWithdrawals(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status } = req.query;
        const result = await service.getCourierWithdrawals({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            status: status as string,
        });
        return res.json(result);
    }

    async getStoreDisbursements(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status } = req.query;
        const result = await service.getStoreDisbursements({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            status: status as string,
        });
        return res.json(result);
    }

    async getCourierDisbursements(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status } = req.query;
        const result = await service.getCourierDisbursements({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            status: status as string,
        });
        return res.json(result);
    }

    async getCourierEarnings(_req: Request, res: Response) {
        const result = await service.getCourierEarnings();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getDayWiseReport(req: Request, res: Response) {
        const { dateFrom, dateTo } = req.query;
        const result = await service.getDayWiseReport(dateFrom as string, dateTo as string);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getItemWiseReport(_req: Request, res: Response) {
        const result = await service.getItemWiseReport();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getStoreWiseReport(_req: Request, res: Response) {
        const result = await service.getStoreWiseReport();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getDisbursementReport(_req: Request, res: Response) {
        const result = await service.getDisbursementReport();
        return res.json(result);
    }
}
