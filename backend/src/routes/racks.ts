import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { racks } from '../db/schema';

export const racksRoutes = new Elysia({ prefix: '/api/racks' })
  .get('/', async () => {
    return await db.select().from(racks).orderBy(asc(racks.sector), asc(racks.name));
  })

  .post('/', async ({ body }) => {
    const { 
      name, 
      sector, 
      total_units, 
      used_units, 
      location, 
      status 
    } = body as any;

    if (!name || !sector || !location) {
      throw new Error('Nome, setor e localização são obrigatórios');
    }

    const result = await db.insert(racks)
      .values({
        name,
        sector,
        total_units: total_units || 42,
        used_units: used_units || 0,
        location,
        status: status || 'active'
      })
      .returning();

    return result[0];
  })

  .put('/:id', async ({ params, body }) => {
    const { 
      name, 
      sector, 
      total_units, 
      used_units, 
      location, 
      status 
    } = body as any;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (sector !== undefined) updateData.sector = sector;
    if (total_units !== undefined) updateData.total_units = total_units;
    if (used_units !== undefined) updateData.used_units = used_units;
    if (location !== undefined) updateData.location = location;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date();

    const result = await db.update(racks)
      .set(updateData)
      .where(eq(racks.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Rack não encontrado');
    }

    return result[0];
  })

  .delete('/:id', async ({ params }) => {
    const result = await db.delete(racks)
      .where(eq(racks.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Rack não encontrado');
    }

    return { message: 'Rack removido com sucesso' };
  });