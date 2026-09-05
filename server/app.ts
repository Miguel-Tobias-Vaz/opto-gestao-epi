import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { handleError } from './http.ts';
import { router } from './routes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function allowedOrigins() {
  const extras = [process.env.APP_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '']
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter(Boolean) as string[];
  extras.push(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return ['http://localhost:5173', 'http://127.0.0.1:5173', ...extras.filter(Boolean)];
}

export function createApp(options: { serveStatic?: boolean } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        const allowed = allowedOrigins();
        callback(null, allowed.includes(origin) || origin.endsWith('.vercel.app'));
      },
      credentials: true,
      exposedHeaders: ['X-Access-Token'],
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use('/api', router);
  app.use(handleError);

  if (options.serveStatic) {
    const dist = path.join(root, 'dist');
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}
