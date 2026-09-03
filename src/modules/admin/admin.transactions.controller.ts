import { Request, Response } from 'express';
import { AdminTransactionsService } from './admin.transactions.service';

const service = new AdminTransactionsService();

function dateRangeFromQuery(query: Request['query']) {
    const from = (query.from || query.dateFrom) as string | undefined;
    const to = (query.to || query.dateTo) as string | undefined;
    return { from, to };
}

export class AdminTransactionsController {
    async getTransactionReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getTransactionReport(from, to);
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
        const { page, limit, dateFrom, dateTo, status, search, from, to } = req.query;
        const result = await service.getAccountTransactions({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: (dateFrom || from) as string,
            dateTo: (dateTo || to) as string,
            status: status as string,
            search: search as string,
        });
        return res.json(result);
    }

    async createAccountTransaction(req: Request, res: Response) {
        const result = await service.createAccountTransaction(req.body || {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async getStoreWithdrawals(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status, from, to } = req.query;
        const result = await service.getStoreWithdrawals({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: (dateFrom || from) as string,
            dateTo: (dateTo || to) as string,
            status: status as string,
        });
        return res.json(result);
    }

    async getCourierWithdrawals(req: Request, res: Response) {
        const { page, limit, dateFrom, dateTo, status, from, to } = req.query;
        const result = await service.getCourierWithdrawals({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dateFrom: (dateFrom || from) as string,
            dateTo: (dateTo || to) as string,
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

    async createCourierEarning(req: Request, res: Response) {
        const result = await service.createCourierEarning(req.body || {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async getDayWiseReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getDayWiseReport(from, to);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getItemWiseReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getItemWiseReport(from, to);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getStoreWiseReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getStoreWiseReport(from, to);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getDisbursementReport(_req: Request, res: Response) {
        const result = await service.getDisbursementReport();
        return res.json(result);
    }

    async getOrderReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getOrderReport(from, to);
        return res.json(result);
    }

    async getExpenseReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getExpenseReport(from, to);
        return res.json(result);
    }

    async getVendorWiseTaxesReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getVendorWiseTaxesReport(from, to);
        return res.json(result);
    }

    async getParcelWiseTaxesReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getParcelWiseTaxesReport(from, to);
        return res.json(result);
    }

    async getRentalTransactionReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getRentalTransactionReport(from, to);
        return res.json(result);
    }

    async getRentalVehicleReport(_req: Request, res: Response) {
        const result = await service.getRentalVehicleReport();
        return res.json(result);
    }

    async getRentalProviderWiseReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getRentalProviderWiseReport(from, to);
        return res.json(result);
    }

    async getRentalTripReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getRentalTripReport(from, to);
        return res.json(result);
    }

    async getRentalProviderWiseTaxesReport(req: Request, res: Response) {
        const { from, to } = dateRangeFromQuery(req.query);
        const result = await service.getRentalProviderWiseTaxesReport(from, to);
        return res.json(result);
    }
}
