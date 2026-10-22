import { resend } from '../../config/resend';
import axios from 'axios';
import dotenv from 'dotenv';
import { supabase } from '../../config/supabase';

dotenv.config();

export class EmailService {
    private static fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'Sendo <onboarding@sendo.express>';
    private static termiiUrl = 'https://api.ng.termii.com/api/email/otp/send';

    async sendEmail(email: string, title: string, content: string): Promise<{ success: boolean; message: string }> {
        // If it's an OTP (contains a 6-digit code in the content or title), and Termii is configured, use Termii
        const otpMatch = content.match(/\b\d{6}\b/);
        const termiiApiKey = process.env.TERMII_API_KEY;
        const termiiConfigId = process.env.TERMII_EMAIL_CONFIG_ID;

        if (termiiApiKey && termiiConfigId && (otpMatch || title.toLowerCase().includes('verification') || title.toLowerCase().includes('otp'))) {
            try {
                const otpCode = otpMatch ? otpMatch[0] : '';
                console.log(`[EMAIL] Attempting to send OTP via Termii to ${email}...`);
                
                const response = await axios.post(EmailService.termiiUrl, {
                    api_key: termiiApiKey,
                    email_address: email,
                    email_configuration_id: termiiConfigId,
                    code: otpCode
                });

                console.log(`[EMAIL] Termii Email Response:`, response.data);
                return { success: true, message: 'OTP sent successfully via Termii Email' };
            } catch (err: any) {
                console.error('Termii Email Error:', err.response?.data || err.message);
                // Fallback to Resend if Termii fails
            }
        }

        // Default to Resend for non-OTP or if Termii is not configured/fails
        try {
            const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || EmailService.fromEmail;
            const { data, error } = await resend.emails.send({
                from,
                to: email,
                subject: title,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #333;">${title}</h2>
                        <div style="margin: 20px 0; line-height: 1.6;">${content}</div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #888;">&copy; 2026 Sendo Delivery</p>
                    </div>
                `,
            });

            if (error) {
                console.error('Resend API Error:', error);
                return { success: false, message: error.message || 'Failed to send email' };
            }

            console.log(`[EMAIL] Email "${title}" sent to ${email} from ${from} via Resend. ID: ${data?.id}`);
            return { success: true, message: 'Email sent successfully via Resend' };
        } catch (err: any) {
            console.error('Email Service Error:', err);
            return { success: false, message: err.message || 'Internal server error during email delivery' };
        }
    }
    async sendCustomerOrderCompletedEmail(params: {
        customerEmail: string;
        customerName?: string;
        orderId: string;
        storeName?: string;
        totalAmount: number;
        items?: Array<{ name: string; quantity: number }>;
    }): Promise<{ success: boolean; message: string }> {
        if (!params.customerEmail) return { success: false, message: 'No customer email provided' };

        const orderShortId = params.orderId.toString().slice(-6).toUpperCase();
        const title = `Thank you for your order! #${orderShortId}`;
        const name = params.customerName?.trim() || 'Valued Customer';
        const store = params.storeName || 'our partner store';

        const itemsRows = params.items && params.items.length > 0
            ? params.items.map(it => `
                <tr>
                    <td style="padding: 6px 14px; color: #333; font-size: 14px;">${it.quantity}x ${it.name}</td>
                </tr>
            `).join('')
            : '';

        const itemsHtml = itemsRows
            ? `
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #f9f9f9; border-radius: 8px;">
                    <tr>
                        <td style="padding: 10px 14px 6px 14px; font-weight: bold; color: #444; font-size: 14px;">Order Summary:</td>
                    </tr>
                    ${itemsRows}
                    <tr>
                        <td style="padding: 10px 14px; border-top: 1px solid #eaeaea; font-weight: bold; color: #333; font-size: 15px;">
                            Total Paid: <span style="color: #fb272c; float: right;">₦${Number(params.totalAmount || 0).toLocaleString()}</span>
                        </td>
                    </tr>
                </table>
            `
            : `
                <div style="margin: 16px 0; padding: 14px; background: #fdf2f2; border: 1px solid #fecaca; border-radius: 8px;">
                    <span style="font-weight: 600; color: #333;">Total Paid: </span>
                    <span style="font-size: 16px; font-weight: 700; color: #fb272c; float: right;">₦${Number(params.totalAmount || 0).toLocaleString()}</span>
                </div>
            `;

        const content = `
            <p style="font-size: 15px; color: #333; margin-bottom: 12px;">Hi ${name},</p>
            <p style="font-size: 14px; color: #444; line-height: 1.6;">
                Thank you for ordering with Sendo! Your order <strong>#${orderShortId}</strong> from <strong>${store}</strong> has been successfully delivered.
            </p>
            ${itemsHtml}
            <p style="font-size: 14px; color: #555; margin-top: 16px;">
                We hope you enjoy your order! Thank you for choosing Sendo.
            </p>
            <p style="font-size: 14px; color: #333; margin-top: 16px; font-weight: 500;">
                Warm regards,<br>The Sendo Team
            </p>
        `;

        return this.sendEmail(params.customerEmail, title, content);
    }

    async sendMerchantOrderCompletedEmail(params: {
        merchantEmail: string;
        storeName?: string;
        orderId: string;
        merchantEarnings: number;
    }): Promise<{ success: boolean; message: string }> {
        if (!params.merchantEmail) return { success: false, message: 'No merchant email provided' };

        const orderShortId = params.orderId.toString().slice(-6).toUpperCase();
        const title = `Order #${orderShortId} Completed - You made ₦${Number(params.merchantEarnings || 0).toLocaleString()}`;
        const store = params.storeName || 'Partner Store';

        const content = `
            <p style="font-size: 15px; color: #333; margin-bottom: 12px;">Hi ${store},</p>
            <p style="font-size: 14px; color: #444; line-height: 1.6;">
                Thank you for fulfilling order <strong>#${orderShortId}</strong>! The order has been successfully delivered to the customer.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <tr>
                    <td style="padding: 18px; text-align: center;">
                        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #166534; font-weight: bold; margin-bottom: 4px;">You Made</div>
                        <div style="font-size: 26px; font-weight: bold; color: #15803d; margin-bottom: 4px;">₦${Number(params.merchantEarnings || 0).toLocaleString()}</div>
                        <div style="font-size: 12px; color: #166534;">Credited to your store balance (0% commission deducted)</div>
                    </td>
                </tr>
            </table>
            <p style="font-size: 14px; color: #555; margin-top: 16px;">
                Thank you for your dedication to delighting customers on Sendo. Keep up the great work!
            </p>
            <p style="font-size: 14px; color: #333; margin-top: 16px; font-weight: 500;">
                Warm regards,<br>The Sendo Team
            </p>
        `;

        return this.sendEmail(params.merchantEmail, title, content);
    }

    async sendOrderDeliveredEmails(orderId: string, orderData: any, merchantShare: number): Promise<void> {
        try {
            // 1. Resolve Customer info
            let customerEmail = orderData?.consumer?.email;
            let customerName = `${orderData?.consumer?.first_name || ''} ${orderData?.consumer?.last_name || ''}`.trim();

            if (!customerEmail && orderData?.consumer_id) {
                const { data: customer } = await supabase
                    .from('users')
                    .select('email, first_name, last_name')
                    .eq('id', orderData.consumer_id)
                    .single();
                if (customer) {
                    customerEmail = customer.email;
                    customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                }
            }

            // 2. Resolve Merchant info
            let merchantEmail = orderData?.merchant?.contact_email;
            let storeName = orderData?.merchant?.name;

            if ((!merchantEmail || !storeName) && orderData?.merchant_id) {
                const { data: merchantStore } = await supabase
                    .from('merchants')
                    .select('user_id, name, contact_email')
                    .eq('id', orderData.merchant_id)
                    .single();

                if (merchantStore) {
                    storeName = storeName || merchantStore.name;
                    merchantEmail = merchantEmail || merchantStore.contact_email;

                    if (!merchantEmail && merchantStore.user_id) {
                        const { data: merchantUser } = await supabase
                            .from('users')
                            .select('email')
                            .eq('id', merchantStore.user_id)
                            .single();
                        merchantEmail = merchantUser?.email;
                    }
                }
            }

            // 3. Resolve Items
            let items = orderData?.items;
            if (!items && orderId) {
                const { data: dbItems } = await supabase
                    .from('order_items')
                    .select('quantity, product:products(name)')
                    .eq('order_id', orderId);
                items = dbItems;
            }

            const formattedItems = (items || []).map((it: any) => ({
                name: it?.product?.name || it?.name || 'Item',
                quantity: Number(it?.quantity || 1),
            }));

            const promises: Promise<any>[] = [];

            if (customerEmail) {
                promises.push(
                    this.sendCustomerOrderCompletedEmail({
                        customerEmail,
                        customerName: customerName || 'Valued Customer',
                        orderId,
                        storeName: storeName || 'our partner store',
                        totalAmount: Number(orderData?.total_price || orderData?.total_amount || 0),
                        items: formattedItems,
                    }).catch(err => console.error('[EmailService] Customer delivery email error:', err.message))
                );
            }

            if (merchantEmail) {
                promises.push(
                    this.sendMerchantOrderCompletedEmail({
                        merchantEmail,
                        storeName: storeName || 'Partner Store',
                        orderId,
                        merchantEarnings: merchantShare,
                    }).catch(err => console.error('[EmailService] Merchant delivery email error:', err.message))
                );
            }

            await Promise.allSettled(promises);
        } catch (err: any) {
            console.error('[EmailService] Failed to send order delivered emails:', err.message);
        }
    }
}

