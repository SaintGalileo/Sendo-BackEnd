import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { PaymentsController } from './modules/payments/payments.controller';

dotenv.config();

const app = express();
const paymentsController = new PaymentsController();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Public keep-alive / probe — no auth, no DB (used by GitHub Actions cron).
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

// Top-level Webhook endpoints (supports URLs with and without /api prefix)
app.post('/payments/webhook/paystack', (req, res) => paymentsController.handlePaystackWebhook(req, res));
app.post('/webhook/paystack', (req, res) => paymentsController.handlePaystackWebhook(req, res));
app.get('/payments/webhook/paystack', (_req, res) => res.status(200).send('Paystack webhook endpoint is active'));
app.get('/webhook/paystack', (_req, res) => res.status(200).send('Paystack webhook endpoint is active'));
app.post('/payments/webhook/seerbit', (req, res) => paymentsController.handleSeerBitWebhook(req, res));

app.use('/api', routes);

app.get('/', (_req, res) => res.send('Server is running'));

export default app;
