import { Request, Response } from 'express';
import { AdminSettingsService } from './admin.settings.service';

const service = new AdminSettingsService();

export class AdminSettingsController {
    async getBusinessSettings(_req: Request, res: Response) {
        const result = await service.getBusinessSettings();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async updateBusinessSettings(req: Request, res: Response) {
        const result = await service.updateBusinessSettings(req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getTaxSettings(_req: Request, res: Response) {
        const result = await service.getTaxSettings();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async createTax(req: Request, res: Response) {
        const result = await service.createTax(req.body ?? {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateTaxSettings(req: Request, res: Response) {
        const result = await service.updateTaxSettings(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getPaymentMethods(_req: Request, res: Response) {
        const result = await service.getPaymentMethods();
        return res.status(200).json(result);
    }

    async updatePaymentMethods(req: Request, res: Response) {
        const result = await service.updatePaymentMethods(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getAnalyticSettings(_req: Request, res: Response) {
        const result = await service.getAnalyticSettings();
        return res.status(200).json(result);
    }

    async updateAnalyticSettings(req: Request, res: Response) {
        const result = await service.updateAnalyticSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getWebsocketSettings(_req: Request, res: Response) {
        const result = await service.getWebsocketSettings();
        return res.status(200).json(result);
    }

    async updateWebsocketSettings(req: Request, res: Response) {
        const result = await service.updateWebsocketSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getAiSettings(_req: Request, res: Response) {
        const result = await service.getAiSettings();
        return res.status(200).json(result);
    }

    async updateAiSettings(req: Request, res: Response) {
        const result = await service.updateAiSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getSubscriptionSettings(_req: Request, res: Response) {
        const result = await service.getSubscriptionSettings();
        return res.status(200).json(result);
    }

    async updateSubscriptionSettings(req: Request, res: Response) {
        const result = await service.updateSubscriptionSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getSubscriptionPackages(_req: Request, res: Response) {
        const result = await service.getSubscriptionPackages();
        return res.status(200).json(result);
    }

    async updateSubscriptionPackages(req: Request, res: Response) {
        const result = await service.updateSubscriptionPackages(req.body?.packages ?? req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getSubscriptionSubscribers(_req: Request, res: Response) {
        const result = await service.getSubscriptionSubscribers();
        return res.status(200).json(result);
    }

    async getModules(_req: Request, res: Response) {
        const result = await service.getModules();
        return res.status(200).json(result);
    }

    async updateModules(req: Request, res: Response) {
        const result = await service.updateModules(req.body?.modules ?? req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getFcmMessages(_req: Request, res: Response) {
        const result = await service.getFcmMessages();
        return res.status(200).json(result);
    }

    async updateFcmMessages(req: Request, res: Response) {
        const result = await service.updateFcmMessages(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getFcmConfig(_req: Request, res: Response) {
        const result = await service.getFcmConfig();
        return res.status(200).json(result);
    }

    async updateFcmConfig(req: Request, res: Response) {
        const result = await service.updateFcmConfig(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getNotificationChannels(_req: Request, res: Response) {
        const result = await service.getNotificationChannels();
        return res.status(200).json(result);
    }

    async updateNotificationChannels(req: Request, res: Response) {
        const result = await service.updateNotificationChannels(req.body?.channels ?? req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getSmsSettings(_req: Request, res: Response) {
        const result = await service.getSmsSettings();
        return res.status(200).json(result);
    }

    async updateSmsSettings(req: Request, res: Response) {
        const result = await service.updateSmsSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getAppSettings(_req: Request, res: Response) {
        const result = await service.getAppSettings();
        return res.status(200).json(result);
    }

    async updateAppSettings(req: Request, res: Response) {
        const result = await service.updateAppSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getLoginSettings(_req: Request, res: Response) {
        const result = await service.getLoginSettings();
        return res.status(200).json(result);
    }

    async updateLoginSettings(req: Request, res: Response) {
        const result = await service.updateLoginSettings(req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getCmsPage(req: Request, res: Response) {
        const pageKey = String(req.params.pageKey || '');
        if (!pageKey) return res.status(400).json({ success: false, message: 'pageKey required', data: null });
        const result = await service.getCmsPage(pageKey);
        return res.status(200).json(result);
    }

    async updateCmsPage(req: Request, res: Response) {
        const pageKey = String(req.params.pageKey || '');
        if (!pageKey) return res.status(400).json({ success: false, message: 'pageKey required', data: null });
        const result = await service.updateCmsPage(pageKey, req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getWithdrawMethods(_req: Request, res: Response) {
        const result = await service.getWithdrawMethods();
        return res.status(200).json(result);
    }

    async createWithdrawMethod(req: Request, res: Response) {
        const result = await service.createWithdrawMethod(req.body ?? {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateWithdrawMethod(req: Request, res: Response) {
        const result = await service.updateWithdrawMethod(req.params.id as string, req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteWithdrawMethod(req: Request, res: Response) {
        const result = await service.deleteWithdrawMethod(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getCustomRoles(_req: Request, res: Response) {
        const result = await service.getCustomRoles();
        return res.status(200).json(result);
    }

    async createCustomRole(req: Request, res: Response) {
        const result = await service.createCustomRole(req.body ?? {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateCustomRole(req: Request, res: Response) {
        const result = await service.updateCustomRole(req.params.id as string, req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCustomRole(req: Request, res: Response) {
        const result = await service.deleteCustomRole(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
