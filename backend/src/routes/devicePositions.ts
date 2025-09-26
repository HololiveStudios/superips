import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { devicePositions, devices, rooms } from '../db/schema';

export const devicePositionsRoutes = new Elysia({ prefix: '/api/device-positions' })
  .get('/', async () => {
    const result = await db
      .select({
        id: devicePositions.id,
        device_id: devicePositions.device_id,
        room_id: devicePositions.room_id,
        x: devicePositions.x,
        y: devicePositions.y,
        created_at: devicePositions.created_at,
        updated_at: devicePositions.updated_at,
        ip: devices.ip,
        device_name: devices.name,
        type: devices.type,
        user: devices.user,
        sector: devices.sector,
        status: devices.status,
        online: devices.online,
        room_name: rooms.name,
        floor: rooms.floor
      })
      .from(devicePositions)
      .leftJoin(devices, eq(devicePositions.device_id, devices.id))
      .leftJoin(rooms, eq(devicePositions.room_id, rooms.id))
      .orderBy(asc(rooms.floor), asc(rooms.name), asc(devices.name));

    return result;
  })

  .post('/', async ({ body }) => {
    const { device_id, room_id, x, y } = body as any;
    
    if (!device_id || !room_id) {
      throw new Error('device_id e room_id são obrigatórios');
    }

    // Use upsert logic
    const existing = await db.select().from(devicePositions).where(eq(devicePositions.device_id, device_id));
    
    if (existing.length > 0) {
      const result = await db.update(devicePositions)
        .set({ 
          room_id, 
          x: x || 0, 
          y: y || 0,
          updated_at: new Date()
        })
        .where(eq(devicePositions.device_id, device_id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(devicePositions)
        .values({ 
          device_id, 
          room_id, 
          x: x || 0, 
          y: y || 0 
        })
        .returning();
      return result[0];
    }
  })

  .put('/:deviceId', async ({ params, body }) => {
    const { room_id, x, y } = body as any;
    
    const updateData: any = {};
    if (room_id !== undefined) updateData.room_id = room_id;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    updateData.updated_at = new Date();

    const result = await db.update(devicePositions)
      .set(updateData)
      .where(eq(devicePositions.device_id, parseInt(params.deviceId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Posição do dispositivo não encontrada');
    }

    return result[0];
  })

  .delete('/:deviceId', async ({ params }) => {
    const result = await db.delete(devicePositions)
      .where(eq(devicePositions.device_id, parseInt(params.deviceId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Posição do dispositivo não encontrada');
    }

    return { message: 'Posição do dispositivo removida com sucesso' };
  })

  .post('/batch', async ({ body }) => {
    const { positions } = body as { positions: any[] };
    
    if (!Array.isArray(positions)) {
      throw new Error('positions deve ser um array');
    }

    // Use transaction-like approach with Promise.all
    const updates = positions.map(async (pos) => {
      const { device_id, room_id, x, y } = pos;
      
      const existing = await db.select().from(devicePositions).where(eq(devicePositions.device_id, device_id));
      
      if (existing.length > 0) {
        return db.update(devicePositions)
          .set({ room_id, x, y, updated_at: new Date() })
          .where(eq(devicePositions.device_id, device_id));
      } else {
        return db.insert(devicePositions)
          .values({ device_id, room_id, x, y });
      }
    });

    await Promise.all(updates);
    return { success: true, updated: positions.length };
  });