import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { handleError } from './http.ts';
import { router } from './routes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use('/api', router);
app.use(handleError);

if (isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Opto API em http://localhost:${port}`);
  console.log('Banco: Supabase (sem dados de exemplo)');
});
