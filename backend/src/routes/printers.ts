import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';

export const printersRoutes = new Elysia({ prefix: '/api/printers' })
  .get('/', async () => {
    const result = await db.select()
      .from(devices)
      .where(eq(devices.type, 'Impressora'))
      .orderBy(asc(devices.sector), asc(devices.ip));

    return result.map(printer => ({
      ...printer,
      online: Number(printer.online) || 0,
      status: Number(printer.status) || 0,
      npat: printer.npat || 0
    }));
  })

  .put('/:id', async ({ params, body }) => {
    const {
      name,
      ip,
      online,
      status,
      sector,
      model,
      user,
      npat,
      li,
      lf
    } = body as any;

    // Buscar dados atuais da impressora
    const current = await db.select({ ip: devices.ip })
      .from(devices)
      .where(eq(devices.id, parseInt(params.id)));

    if (current.length === 0) {
      throw new Error('Impressora não encontrada');
    }

    const oldIp = current[0].ip;

    // Se o IP mudou, limpar o registro antigo
    if (oldIp && oldIp !== ip) {
      await db.update(devices)
        .set({
          name: null,
          type: null,
          user: null,
          sector: null,
          status: null,
          online: null,
          model: null,
          npat: null,
          li: null,
          lf: null
        })
        .where(eq(devices.ip, oldIp));
    }

    // Verificar se já existe um dispositivo com o novo IP
    const existing = await db.select({ id: devices.id })
      .from(devices)
      .where(eq(devices.ip, ip));

    let result;
    if (existing.length > 0 && existing[0].id !== parseInt(params.id)) {
      // Atualizar o dispositivo existente com o novo IP
      result = await db.update(devices)
        .set({
          name,
          type: 'Impressora',
          online,
          status,
          sector,
          model,
          user,
          npat,
          li,
          lf
        })
        .where(eq(devices.ip, ip))
        .returning();
    } else {
      // Atualizar o dispositivo atual
      result = await db.update(devices)
        .set({
          name,
          ip,
          type: 'Impressora',
          online,
          status,
          sector,
          model,
          user,
          npat,
          li,
          lf
        })
        .where(eq(devices.id, parseInt(params.id)))
        .returning();
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      status: Number(result[0].status) || 0,
    };
  })

  .post('/:id/online', async ({ params, body }) => {
    const online = Number(body?.online);

    if (![0, 1].includes(online)) {
      throw new Error('Invalid online status. Must be 0 or 1.');
    }

    const result = await db.update(devices)
      .set({
        online,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Printer not found or not of type Impressora');
    }

    return result[0];
  });