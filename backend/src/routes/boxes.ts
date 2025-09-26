import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';

export const boxesRoutes = new Elysia({ prefix: '/api/boxes' })
  .get('/', async () => {
    const result = await db.select({
      id: devices.id,
      ip: devices.ip,
      name: devices.name,
      status: devices.status,
      power_status: devices.online,
      codigo_acesso: devices.codigo_acesso,
      identificacao: devices.identificacao,
      chave: devices.chave
    })
    .from(devices)
    .where(eq(devices.sector, 'Caixas'))
    .orderBy(asc(devices.name));

    return result.map(box => ({
      ...box,
      status: Number(box.status) || 0,
      power_status: Number(box.power_status) || 0,
    }));
  })

  .put('/:id', async ({ params, body }) => {
    const {
      name,
      ip,
      status,
      power_status,
      codigo_acesso,
      identificacao,
      chave
    } = body as any;

    // Busca IP antigo
    const current = await db.select({ ip: devices.ip })
      .from(devices)
      .where(eq(devices.id, parseInt(params.id)));

    if (current.length === 0) {
      throw new Error('Caixa não encontrado');
    }

    const oldIp = current[0].ip;

    // Se o IP mudou, limpar registro antigo
    if (oldIp && oldIp !== ip) {
      await db.update(devices)
        .set({
          name: null,
          type: null,
          user: null,
          sector: null,
          status: null,
          online: null,
          codigo_acesso: null,
          identificacao: null,
          chave: null
        })
        .where(eq(devices.ip, oldIp));
    }

    // Verifica se o novo IP já existe em outro registro
    const existing = await db.select({ id: devices.id })
      .from(devices)
      .where(eq(devices.ip, ip));

    let result;
    if (existing.length > 0 && existing[0].id !== parseInt(params.id)) {
      // Atualiza o registro existente
      result = await db.update(devices)
        .set({
          name,
          type: 'Caixa',
          sector: 'Caixas',
          status,
          online: power_status,
          codigo_acesso,
          identificacao,
          chave
        })
        .where(eq(devices.ip, ip))
        .returning();
    } else {
      // Atualiza o próprio registro
      result = await db.update(devices)
        .set({
          name,
          ip,
          type: 'Caixa',
          sector: 'Caixas',
          status,
          online: power_status,
          codigo_acesso,
          identificacao,
          chave
        })
        .where(eq(devices.id, parseInt(params.id)))
        .returning();
    }

    return {
      ...result[0],
      status: Number(result[0].status) || 0,
      power_status: Number(result[0].online) || 0,
    };
  })

  .post('/:id/power-status', async ({ params, body }) => {
    const { power_status } = body as any;

    if (![0, 1].includes(power_status)) {
      throw new Error('Invalid power status. Must be 0 or 1.');
    }

    const result = await db.update(devices)
      .set({
        online: power_status,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Box not found');
    }

    return {
      device_id: result[0].id,
      ip: result[0].ip,
      name: result[0].name,
      status: result[0].status,
      power_status: result[0].online
    };
  });