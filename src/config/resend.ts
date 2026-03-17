import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY || '';

if (!resendApiKey) {
  console.warn('Missing RESEND_API_KEY environment variable');
}

export const resend = new Resend(resendApiKey);
