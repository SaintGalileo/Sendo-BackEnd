import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use('/api', routes);

app.get('/', (req, res) => res.send('Server is running'));

export default app;
