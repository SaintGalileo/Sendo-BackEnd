import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Public keep-alive / probe — no auth, no DB (used by GitHub Actions cron).
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

app.use('/api', routes);

app.get('/', (_req, res) => res.send('Server is running'));

export default app;
