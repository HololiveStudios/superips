// routes/scales.ts
import { Elysia } from 'elysia';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';

export const scalesRoutes = new Elysia({ prefix: '/api/scales' })

  .post('/swap', async ({ body }) => {
    const {
      currentScaleId,
      replacementScaleId,
      isCurrentReserve,
      swapReason,
      swapDate
    } = body as any;

    if (!currentScaleId || !replacementScaleId || !swapReason) {
      throw new Error('Dados obrigatórios faltando');
    }

    const [currentScale] = await db.select()
      .from(devices)
      .where(eq(devices.id, currentScaleId));

    const [replacementScale] = await db.select()
      .from(devices)
      .where(eq(devices.id, replacementScaleId));

    if (!currentScale || !replacementScale) {
      throw new Error('Balança não encontrada');
    }

    let currentUpdate, replacementUpdate;

    if (isCurrentReserve) {
      currentUpdate = await db.update(devices)
        .set({
          ip: replacementScale.ip,
          sector: replacementScale.sector,
          user: replacementScale.user,
          model: replacementScale.model,
          identificacao: null,
          online: 1,
          updated_at: new Date()
        })
        .where(eq(devices.id, currentScaleId))
        .returning();

      replacementUpdate = await db.update(devices)
        .set({
          model: currentScale.model,
          sector: 'Almoxarifado',
          user: swapReason,
          identificacao: swapReason,
          online: 0,
          ip: null,
          updated_at: new Date()
        })
        .where(eq(devices.id, replacementScaleId))
        .returning();
    } else {
      currentUpdate = await db.update(devices)
        .set({
          model: replacementScale.model,
          identificacao: null,
          online: 1,
          updated_at: new Date()
        })
        .where(eq(devices.id, currentScaleId))
        .returning();

      replacementUpdate = await db.update(devices)
        .set({
          model: currentScale.model,
          sector: 'Almoxarifado',
          user: swapReason,
          identificacao: swapReason,
          online: 0,
          ip: null,
          updated_at: new Date()
        })
        .where(eq(devices.id, replacementScaleId))
        .returning();
    }

    if (!currentUpdate[0] || !replacementUpdate[0]) {
      throw new Error('Falha ao realizar troca');
    }

    return {
      currentScale: {
        ...currentUpdate[0],
        online: Number(currentUpdate[0].online) || 0
      },
      replacementScale: {
        ...replacementUpdate[0],
        online: Number(replacementUpdate[0].online) || 0
      },
      swapReason,
      swapDate
    };
  })

  .post('/reserve', async ({ body }) => {
    const {
      name,
      sector,
      model,
      user,
    } = body as any;

    const result = await db.insert(devices)
      .values({
        name: name || null,
        ip: null,
        type: 'Balança',
        online: 0,
        sector: sector || 'Almoxarifado',
        model: model || null,
        user: user || null,
        li: null,
        lf: null,
        rental_type: null,
        identificacao: null
      })
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to create reserve scale');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0
    };
  })

  .get('/stats', async () => {
    const allScales = await db.select()
      .from(devices)
      .where(eq(devices.type, 'Balança'));

    const stats = {
      total: allScales.length,
      active: allScales.filter(s => s.sector !== 'Almoxarifado').length,
      reserve: allScales.filter(s => s.sector === 'Almoxarifado').length,
      withDefect: allScales.filter(s => s.identificacao).length,
      online: allScales.filter(s => s.online === 1).length
    };

    return stats;
  })

  .get('/', async () => {
    const result = await db.select()
      .from(devices)
      .where(eq(devices.type, 'Balança'))
      .orderBy(asc(devices.sector), asc(devices.ip));

    return result.map(scale => ({
      ...scale,
      online: Number(scale.online) || 0,
      defect_reason: scale.identificacao
    }));
  })

  .put('/:id', async ({ params, body }) => {
    const {
      name,
      ip,
      online,
      sector,
      model,
      user,
      defect_reason
    } = body as any;

    const result = await db.update(devices)
      .set({
        name,
        ip,
        type: 'Balança',
        online,
        sector,
        model,
        user,
        identificacao: defect_reason,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to update scale');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      defect_reason: result[0].identificacao
    };
  })

  .post('/:id/online', async ({ params, body }) => {
    const online = Number((body as any)?.online);

    if (![0, 1].includes(online)) {
      throw new Error('Invalid online. Must be 0 or 1.');
    }

    const result = await db.update(devices)
      .set({
        online,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Scale not found');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      defect_reason: result[0].identificacao
    };
  })

  .patch('/:id/defect', async ({ params, body }) => {
    const { defect_reason } = body as any;

    const result = await db.update(devices)
      .set({
        identificacao: defect_reason || null,
        online: defect_reason ? 0 : 1,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Scale not found');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      defect_reason: result[0].identificacao
    };
  });