import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { switches } from '../db/schema';

export const switchesRoutes = new Elysia({ prefix: '/api/switches' })
  .get('/', async () => {
    return await db.select().from(switches).orderBy(asc(switches.sector), asc(switches.name));
  })

  .post('/', async ({ body }) => {
    const { 
      name, 
      model, 
      sector, 
      rack_position, 
      total_ports, 
      used_ports, 
      is_poe, 
      status, 
      ip_address,
      ports_status 
    } = body as any;

    if (!name || !model || !sector) {
      throw new Error('Nome, modelo e setor são obrigatórios');
    }

    const result = await db.insert(switches)
      .values({
        name,
        model,
        sector,
        rack_position: rack_position || 1,
        total_ports: total_ports || 24,
        used_ports: used_ports || 0,
        is_poe: is_poe || false,
        status: status || 'active',
        ip_address: ip_address || '',
        ports_status: JSON.stringify(ports_status || Array(total_ports || 24).fill(false))
      })
      .returning();

    const newSwitch = result[0];
    if (newSwitch.ports_status && typeof newSwitch.ports_status === 'string') {
      newSwitch.ports_status = JSON.parse(newSwitch.ports_status);
    }

    return newSwitch;
  })

  .put('/:id', async ({ params, body }) => {
    const { 
      name, 
      model, 
      sector, 
      rack_position, 
      total_ports, 
      used_ports, 
      is_poe, 
      status, 
      ip_address,
      ports_status 
    } = body as any;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (model !== undefined) updateData.model = model;
    if (sector !== undefined) updateData.sector = sector;
    if (rack_position !== undefined) updateData.rack_position = rack_position;
    if (total_ports !== undefined) updateData.total_ports = total_ports;
    if (used_ports !== undefined) updateData.used_ports = used_ports;
    if (is_poe !== undefined) updateData.is_poe = is_poe;
    if (status !== undefined) updateData.status = status;
    if (ip_address !== undefined) updateData.ip_address = ip_address;
    if (ports_status !== undefined) updateData.ports_status = JSON.stringify(ports_status);
    updateData.updated_at = new Date();

    const result = await db.update(switches)
      .set(updateData)
      .where(eq(switches.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Switch não encontrado');
    }

    const updatedSwitch = result[0];
    if (updatedSwitch.ports_status && typeof updatedSwitch.ports_status === 'string') {
      updatedSwitch.ports_status = JSON.parse(updatedSwitch.ports_status);
    }

    return updatedSwitch;
  })

  .delete('/:id', async ({ params }) => {
    const result = await db.delete(switches)
      .where(eq(switches.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Switch não encontrado');
    }

    return { message: 'Switch removido com sucesso' };
  });