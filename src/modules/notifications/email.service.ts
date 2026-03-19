import { resend } from '../../config/resend';

export class EmailService {
    private static fromEmail = 'Sendo <onboarding@resend.dev>'; // Replace with verified domain in production

    async sendEmail(email: string, title: string, content: string): Promise<{ success: boolean; message: string }> {
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

            console.log(`[EMAIL] Email "${title}" sent to ${email}. ID: ${data?.id}`);
            return { success: true, message: 'Email sent successfully' };
        } catch (err: any) {
            console.error('Email Service Error:', err);
            return { success: false, message: 'Internal server error during email delivery' };
        }
    }
}
