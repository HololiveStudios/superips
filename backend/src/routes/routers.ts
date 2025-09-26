import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';

export const routersRoutes = new Elysia({ prefix: '/api/routers' })
  .get('/', async () => {
    return await db.select()
      .from(devices)
      .where(eq(devices.type, 'Roteador'))
      .orderBy(asc(devices.ip));
  })

  .put('/:id', async ({ params, body }) => {
    const {
      name,
      ip,
      status,
      sector,
      model,
      login_username,
      login_password,
      wifi_ssid,
      wifi_password,
      hidden
    } = body as any;

    // Busca o IP antigo do roteador
    const current = await db.select({ ip: devices.ip })
      .from(devices)
      .where(eq(devices.id, parseInt(params.id)));

    if (current.length === 0) {
      throw new Error('Roteador não encontrado');
    }

    const oldIp = current[0].ip;

    // Se o IP mudou, limpa o IP antigo
    if (oldIp && oldIp !== ip) {
      await db.update(devices)
        .set({
          name: null,
          type: null,
          user: null,
          sector: null,
          status: null,
          model: null,
          login_username: null,
          login_password: null,
          wifi_ssid: null,
          wifi_password: null,
          hidden: null
        })
        .where(eq(devices.ip, oldIp));
    }

    // Verifica se o novo IP já existe
    const existing = await db.select({ id: devices.id })
      .from(devices)
      .where(eq(devices.ip, ip));

    let result;
    if (existing.length > 0) {
      // Atualiza o registro existente com os dados do roteador
      result = await db.update(devices)
        .set({
          name,
          type: 'Roteador',
          status,
          sector,
          model,
          login_username,
          login_password,
          wifi_ssid,
          wifi_password,
          hidden
        })
        .where(eq(devices.ip, ip))
        .returning();
    } else {
      // Atualiza o próprio registro do roteador para usar o novo IP
      result = await db.update(devices)
        .set({
          name,
          ip,
          type: 'Roteador',
          status,
          sector,
          model,
          login_username,
          login_password,
          wifi_ssid,
          wifi_password,
          hidden
        })
        .where(eq(devices.id, parseInt(params.id)))
        .returning();
    }

    return result[0];
  });