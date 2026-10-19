// Chế độ phát triển: một cổng duy nhất, API + Vite (nạp lại nóng).
import { createServer } from 'vite';
import { startServer } from './index.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
startServer({ viteMiddleware: vite.middlewares });
