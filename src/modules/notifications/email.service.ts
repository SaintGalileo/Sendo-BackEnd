import { resend } from '../../config/resend';

export class EmailService {
    private static fromEmail = 'Sendo <onboarding@resend.dev>'; // Replace with verified domain in production

    async sendOTP(email: string, otpCode: string): Promise<{ success: boolean; message: string }> {
        try {
            const { data, error } = await resend.emails.send({
                from: EmailService.fromEmail,
                to: email,
                subject: 'Sendo Verification Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #333;">Sendo Verification</h2>
                        <p>Your verification code is:</p>
                        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${otpCode}</h1>
                        <p>This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #888;">&copy; 2024 Sendo Delivery</p>
                    </div>
                `,
            });

            if (error) {
                console.error('Resend API Error:', error);
                return { success: false, message: 'Failed to send email' };
            }

            console.log(`[EMAIL] OTP ${otpCode} sent to ${email}. ID: ${data?.id}`);
            return { success: true, message: 'Email sent successfully' };
        } catch (err: any) {
            console.error('Email Service Error:', err);
            return { success: false, message: 'Internal server error during email delivery' };
        }
    }
}
