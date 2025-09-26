import { join } from 'path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { readFileSync } from 'fs';

// Import suas rotas
import { devicesRoutes } from './routes/devices';
import { roomsRoutes } from './routes/rooms';
import { devicePositionsRoutes } from './routes/devicePositions';
import { tasksRoutes } from './routes/tasks';
import { switchesRoutes } from './routes/switches';
import { racksRoutes } from './routes/racks';
import { routersRoutes } from './routes/routers';
import { printersRoutes } from './routes/printers';
import { boxesRoutes } from './routes/boxes';
import { mapDataRoutes } from './routes/mapData';
import { monitoringRoutes } from './routes/monitoring';

const frontendPath = join(__dirname, '../../dist');
const indexHtml = readFileSync(join(frontendPath, 'index.html'), 'utf-8');

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: frontendPath, prefix: '/' }))
  .use(devicesRoutes)
  .use(roomsRoutes)
  .use(devicePositionsRoutes)
  .use(tasksRoutes)
  .use(switchesRoutes)
  .use(racksRoutes)
  .use(routersRoutes)
  .use(printersRoutes)
  .use(boxesRoutes)
  .use(mapDataRoutes)
  .use(monitoringRoutes)
  // SPA fallback: qualquer rota que não seja /api retorna index.html
  .get('/**', ({ set }) => {
    set.status = 200;
    return indexHtml;
  })
  .listen({ hostname: '10.0.11.150', port: 5173 });

console.log(`Servidor rodando em http://10.0.11.150:5173, front-end servido da pasta ../../dist`);

export default app;
