import { resend } from '../../config/resend';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
    private static fromEmail = 'Sendo <onboarding@resend.dev>'; // Replace with verified domain in production
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
            const { data, error } = await resend.emails.send({
                from: EmailService.fromEmail,
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
                return { success: false, message: 'Failed to send email' };
            }

            console.log(`[EMAIL] Email "${title}" sent to ${email} via Resend. ID: ${data?.id}`);
            return { success: true, message: 'Email sent successfully via Resend' };
        } catch (err: any) {
            console.error('Email Service Error:', err);
            return { success: false, message: 'Internal server error during email delivery' };
        }
    }
}

