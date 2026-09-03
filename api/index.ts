import { createApp } from '../server/app.ts';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

export default createApp();
