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
        console.log('[WEBHOOK] Received SeerBit notification:', JSON.stringify(payload, null, 2));

        // 1. Save the notification in the database immediately (as requested by docs)
        const { data: notification, error: logError } = await supabase
            .from('payment_notifications')
            .insert([{
                provider: 'seerbit',
                payload: payload,
                status: 'received'
            }])
            .select()
            .single();

        if (logError) {
            console.error('[WEBHOOK] Failed to log notification:', logError);
        }

        // 2. Acknowledge the notification with status 200 (as requested by docs)
        // We do this after logging but before business logic to satisfy the 10s requirement
        // Actually, Express waits for the handler to finish unless we send early. 
        // But we want to ensure business logic runs. We'll send at the end or use a background process.
        // For now, we'll follow the flow: Log -> Logic -> Respond 200.

        try {
            // Normalize payload: SeerBit can send a direct object or an array (if wrapped)
            let items = [];
            if (payload.notificationItems && Array.isArray(payload.notificationItems)) {
                items = payload.notificationItems.map((item: any) => item.notificationRequestItem).filter(Boolean);
            } else if (payload.eventType && payload.data) {
                // Direct SeerBit payload
                items = [payload];
            } else if (payload.data && payload.data.reference) {
                // Another common variation
                items = [{ eventType: payload.resourceType || 'transaction', data: payload.data }];
            }

            if (items.length === 0) {
                console.warn('[WEBHOOK] No valid notification items found in payload');
                if (notification) await supabase.from('payment_notifications').update({ status: 'ignored' }).eq('id', notification.id);
                return res.status(200).json({ status: 'ACK' });
            }

            for (const item of items) {
                const { eventType, data } = item;
                if (!data) {
                    console.warn('[WEBHOOK] Item missing data:', item);
                    continue;
                }

                // SeerBit uses 'transaction' or 'transaction.success' etc. 
                // We check gatewayMessage or status
                const isSuccessful = (
                    data.gatewayMessage?.toLowerCase() === 'successful' || 
                    data.gatewayMessage?.toLowerCase() === 'approved' || 
                    data.status?.toLowerCase() === 'success' || 
                    data.status?.toLowerCase() === 'completed' ||
                    data.mStatus?.toLowerCase() === 'success'
                );

                console.log(`[WEBHOOK] Item success check: ${isSuccessful} (msg: ${data.gatewayMessage}, status: ${data.status}, mStatus: ${data.mStatus})`);

                if (isSuccessful) {
                    const { amount, email, reference, currency, creditAccountNumber, paymentReference } = data;
                    const finalRef = reference || paymentReference;
                    
                    // Robust amount parsing (handle strings with commas)
                    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, ''));

                    console.log(`[WEBHOOK] Processing successful transaction: ${finalRef}, Amount: ${parsedAmount} (Original: ${amount}), Account: ${creditAccountNumber}`);

                    if (isNaN(parsedAmount) || parsedAmount <= 0) {
                        console.error('[WEBHOOK] Invalid amount skipped:', amount);
                        continue;
                    }

                    // Find wallet by account number, reference, or email (as fallback)
                    const { data: wallet, error: walletError } = await supabase
                        .from('wallets')
                        .select('user_id, balance')
                        .or(`account_number.eq.${creditAccountNumber},reference.eq.${finalRef}`)
                        .maybeSingle();

                    if (walletError) {
                        console.error('[WEBHOOK] Database error searching for wallet:', walletError);
                        continue;
                    }

                    if (!wallet) {
                        console.error(`[WEBHOOK] Wallet NOT FOUND for account ${creditAccountNumber} or ref ${finalRef}. Check your 'wallets' table.`);
                        continue;
                    }

                    console.log(`[WEBHOOK] Found wallet for user ${wallet.user_id}, Current balance: ${wallet.balance}`);

                    // Credit the wallet
                    const creditResult = await walletService.credit(wallet.user_id, parsedAmount, `SeerBit Funding: ${creditAccountNumber || finalRef}`);
                    console.log('[WEBHOOK] Credit result:', creditResult);

                    // Send notification email if email exists
                    const targetEmail = email || data.customer?.email;
                    if (targetEmail) {
                        console.log(`[WEBHOOK] Attempting to send email to ${targetEmail}`);
                        await emailService.sendEmail(targetEmail, 'Wallet Funded!', `
                            <p>Your account has been credited with <b>${currency || 'NGN'} ${parsedAmount}</b>.</p>
                            <p>New balance: <b>${currency || 'NGN'} ${Number(wallet.balance) + parsedAmount}</b></p>
                        `).then(res => {
                            console.log('[WEBHOOK] Email send result:', res);
                        }).catch(e => {
                            console.error('[WEBHOOK] Email failed:', e);
                        });
                    } else {
                        console.warn('[WEBHOOK] No email found in payload to send notification');
                    }
                } else {
                    console.warn(`[WEBHOOK] Skipping non-successful transaction (eventType: ${eventType})`);
                }
            }

            // Update notification status to processed
            if (notification) {
                await supabase
                    .from('payment_notifications')
                    .update({ status: 'processed' })
                    .eq('id', notification.id);
            }

            return res.status(200).json({ status: 'SUCCESS' });
        } catch (error: any) {
            console.error('[WEBHOOK] Error processing webhook:', error);
            if (notification) {
                await supabase
                    .from('payment_notifications')
                    .update({ status: 'error', error_message: error.message })
                    .eq('id', notification.id);
            }
            // Always return 200 to SeerBit to stop retries if we handled it/logged it
            return res.status(200).json({ status: 'ERROR_PROCESSED', message: error.message });
        }
    }
}
