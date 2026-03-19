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
        const payload = req.body;
        try {
            // normalize payload
            let items: any[] = [];
            if (payload.notificationItems && Array.isArray(payload.notificationItems)) {
                items = payload.notificationItems.map((item: any) => item.notificationRequestItem).filter((i: any) => i && i.data);
            } else if (payload.eventType && payload.data) {
                items = [payload];
            } else if (payload.data && (payload.data.reference || payload.data.creditAccountNumber)) {
                items = [{ eventType: payload.resourceType || 'transaction', data: payload.data }];
            }

            if (items.length === 0) {
                console.warn('[WEBHOOK] No valid notification items found in payload');
                return res.status(200).json({ status: 'ACK' });
            }

            for (const item of items) {
                const { data } = item;

                const isSuccessful = (
                    data.gatewayMessage?.toLowerCase() === 'successful' ||
                    data.gatewayMessage?.toLowerCase() === 'approved' ||
                    data.status?.toLowerCase() === 'success' ||
                    data.status?.toLowerCase() === 'completed' ||
                    data.mStatus?.toLowerCase() === 'success' ||
                    data.reason?.toLowerCase() === 'successful'
                );

                if (!isSuccessful) {
                    console.warn(`[WEBHOOK] Skipping non-successful transaction: ${data.gatewayMessage || data.reason}`);
                    continue;
                }

                const { amount, email, reference, creditAccountNumber, paymentReference } = data;
                const finalRef = reference || paymentReference;
                const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, ''));

                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                    console.error('[WEBHOOK] Invalid amount skipped:', amount);
                    continue;
                }

                console.log(`[WEBHOOK] Processing successful transaction: ${finalRef}, Amount: ${parsedAmount}, Account: ${creditAccountNumber}, Email: ${email}`);

                // step1: Find wallet by account number or reference
                let { data: wallet, error: walletError } = await supabase
                    .from('wallets')
                    .select('id, user_id, balance')
                    .or(`account_number.eq.${creditAccountNumber},reference.eq.${finalRef}`)
                    .maybeSingle();

                // step2: If fail, find wallet by user email (back)
                if (!wallet && email) {
                    console.log(`[WEBHOOK] Wallet not found by account/ref, trying email: ${email}`);
                    const { data: user, error: userError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();

                    if (user && user.id) {
                        const { data: emailWallet, error: ewError } = await supabase
                            .from('wallets')
                            .select('id, user_id, balance')
                            .eq('user_id', user.id)
                            .maybeSingle();
                        wallet = emailWallet;
                    }
                }

                if (!wallet) {
                    console.error(`[WEBHOOK] Wallet NOT FOUND for account ${creditAccountNumber}, ref ${finalRef}, or email ${email}.`);
                    continue;
                }



                // Credit the wallet (this also writes to wallet_transactions)
                await walletService.credit(wallet.user_id, parsedAmount, `SeerBit Funding: ${creditAccountNumber || finalRef}`);


                // Send notification email (as requested by user)
                const targetEmail = email || data.customer?.email;
                if (targetEmail) {
                    await emailService.sendEmail(targetEmail, 'Wallet Funded!', `
                        <p>Your account has been credited with <b>NGN ${parsedAmount}</b>.</p>
                        <p>New balance: <b>NGN ${Number(wallet.balance) + parsedAmount}</b></p>
                    `).catch(err => console.error('[WEBHOOK] Failed to send email:', err));
                }

                const notificationsService = new (require('../notifications/notifications.service').NotificationsService)();
                await notificationsService.sendPushNotification(
                    wallet.user_id,
                    'Wallet Funded!',
                    `Your account has been credited with NGN ${parsedAmount}. New balance: NGN ${Number(wallet.balance) + parsedAmount}`
                ).catch((err: any) => console.error('[WEBHOOK] Failed to send push notification:', err));
            }

            return res.status(200).json({ status: 'SUCCESS' });
        } catch (error: any) {
            console.error('[WEBHOOK] Error processing webhook:', error);
            return res.status(200).json({ status: 'ERROR_PROCESSED', message: error.message });
        }
    }
}
