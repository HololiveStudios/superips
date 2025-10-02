import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'

import { devicesRoutes } from './routes/devices'
import { roomsRoutes } from './routes/rooms'
import { devicePositionsRoutes } from './routes/devicePositions'
import { tasksRoutes } from './routes/tasks'
import { switchesRoutes } from './routes/switches'
import { racksRoutes } from './routes/racks'
import { routersRoutes } from './routes/routers'
import { printersRoutes } from './routes/printers'
import { boxesRoutes } from './routes/boxes'
import { mapDataRoutes } from './routes/mapData'
import { monitoringRoutes } from './routes/monitoring'
import { scalesRoutes } from './routes/scales'
import { dailyTasksRoutes } from './routes/dailyTasksRoutes'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const frontendPath = join(__dirname, '../../dist')
const indexHtml = readFileSync(join(frontendPath, 'index.html'), 'utf-8')

console.log('Caminho do front-end:', frontendPath)

const app = new Elysia()
  .use(cors())
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
  .use(scalesRoutes)
  .use(dailyTasksRoutes)
  .use(staticPlugin({ assets: frontendPath, prefix: '/' }))
  .get('/**', ({ set, path }) => {
    if (path.startsWith('/api/')) {
      set.status = 404
      return { error: 'Not found' }
    }
    set.status = 200
    return indexHtml
  })
  .listen({ hostname: '0.0.0.0', port: 5173 })

console.log(`Servidor rodando em http://0.0.0.0:5173, front-end servido da pasta ../../dist`)

export default app