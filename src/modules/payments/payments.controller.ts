import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { PaymentsService } from './payments.service';
import { WalletService } from './wallet.service';
import { EmailService } from '../notifications/email.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const paymentsService = new PaymentsService();
const walletService = new WalletService();
const emailService = new EmailService();

export class PaymentsController {
    async createIntent(req: AuthRequest, res: Response) {
        try {
            const { orderId, amount } = req.body;
            if (!orderId || !amount) return sendResponse(res, 400, false, 'Order ID and amount are required');

            const intent = await paymentsService.createIntent(req.user.id, orderId, amount);
            return sendResponse(res, 201, true, 'Payment intent created', intent);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async confirmPayment(req: AuthRequest, res: Response) {
        try {
            const { transactionId } = req.body;
            if (!transactionId) return sendResponse(res, 400, false, 'Transaction ID is required');

            const payment = await paymentsService.confirmPayment(req.user.id, transactionId);
            return sendResponse(res, 200, true, 'Payment confirmed', payment);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getHistory(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const history = await paymentsService.getHistory(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Payment history fetched', formatPaginatedResponse(history.data, history.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async addTip(req: AuthRequest, res: Response) {
        try {
            const { orderId, amount } = req.body;
            if (!orderId || !amount) return sendResponse(res, 400, false, 'Order ID and tip amount are required');

            const tip = await paymentsService.addTip(req.user.id, orderId, amount);
            return sendResponse(res, 201, true, 'Tip added successfully', tip);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async refundPayment(req: AuthRequest, res: Response) {
        try {
            const { orderId } = req.body;
            if (!orderId) return sendResponse(res, 400, false, 'Order ID is required');

            const refund = await paymentsService.refundPayment(req.user.id, orderId);
            return sendResponse(res, 200, true, 'Payment refunded', refund);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getWalletBalance(req: AuthRequest, res: Response) {
        try {
            const wallet = await walletService.getOrCreateWallet(req.user.id);
            return sendResponse(res, 200, true, 'Wallet balance fetched', { balance: wallet.balance });
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getWalletTransactions(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const txns = await walletService.getTransactions(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Wallet transactions fetched', formatPaginatedResponse(txns.data, txns.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getWallet(req: AuthRequest, res: Response) {
        try {
            const wallet = await walletService.getOrCreateWallet(req.user.id);
            // Optionally include transactions if needed, for now just the wallet
            return sendResponse(res, 200, true, 'Wallet fetched successfully', wallet);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async handleSeerBitWebhook(req: Request, res: Response) {
        try {
            const { notificationItems } = req.body;
            
            if (!notificationItems || !Array.isArray(notificationItems)) {
                return res.status(200).json({ status: 'ACK' }); // Still acknowledge
            }

            for (const item of notificationItems) {
                const { notificationRequestItem } = item;
                if (!notificationRequestItem) continue;

                const { eventType, data } = notificationRequestItem;

                // We only care about transaction success for funding
                if (eventType === 'transaction' && data.gatewayMessage === 'Successful') {
                    const { amount, email, reference, currency } = data;

                    // Find wallet by reference (SeerBit uses the reference we gave him)
                    const { data: wallet, error: walletError } = await supabase
                        .from('wallets')
                        .select('user_id, balance')
                        .eq('reference', reference)
                        .single();

                    if (walletError || !wallet) {
                        console.error(`Webhook Error: Wallet for reference ${reference} not found`);
                        continue;
                    }

                    // Credit the wallet
                    await walletService.credit(wallet.user_id, Number(amount), `SeerBit Funding: ${reference}`);

                    // Send notification email
                    await emailService.sendEmail(email, 'Wallet Funded!', `
                        <p>Your account has been credited with <b>${currency} ${amount}</b>.</p>
                        <p>New balance: <b>${currency} ${Number(wallet.balance) + Number(amount)}</b></p>
                    `);
                }
            }

            return res.status(200).json({ status: 'SUCCESS' });
        } catch (error: any) {
            console.error('Webhook processing error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error during webhook processing' });
        }
    }
}
