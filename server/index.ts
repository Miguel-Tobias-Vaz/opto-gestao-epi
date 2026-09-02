import 'dotenv/config';
import { createApp } from './app.ts';

const port = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

createApp({ serveStatic: isProd }).listen(port, () => {
  console.log(`Opto API em http://localhost:${port}`);
  console.log('Banco: Supabase (sem dados de exemplo)');
});
