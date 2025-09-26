import { Elysia } from 'elysia';
import { eq, asc, count } from 'drizzle-orm';
import { db } from '../db/database';
import { rooms, devicePositions } from '../db/schema';

export const roomsRoutes = new Elysia({ prefix: '/api/rooms' })
  .get('/', async () => {
    const result = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        x: rooms.x,
        y: rooms.y,
        width: rooms.width,
        height: rooms.height,
        floor: rooms.floor,
        created_at: rooms.created_at,
        updated_at: rooms.updated_at,
        device_count: count(devicePositions.device_id)
      })
      .from(rooms)
      .leftJoin(devicePositions, eq(rooms.id, devicePositions.room_id))
      .groupBy(rooms.id, rooms.name, rooms.x, rooms.y, rooms.width, rooms.height, rooms.floor, rooms.created_at, rooms.updated_at)
      .orderBy(asc(rooms.floor), asc(rooms.name));

    return result.map(room => ({
      ...room,
      x: room.x ?? 100,
      y: room.y ?? 100,
      width: room.width ?? 300,
      height: room.height ?? 200,
      floor: room.floor ?? 1
    }));
  })

  .put('/:id', async ({ params, body }) => {
    const { name, x, y, width, height, floor } = body as any;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (x !== undefined) updateData.x = parseFloat(x);
    if (y !== undefined) updateData.y = parseFloat(y);
    if (width !== undefined) updateData.width = parseFloat(width);
    if (height !== undefined) updateData.height = parseFloat(height);
    if (floor !== undefined) updateData.floor = floor;
    updateData.updated_at = new Date();

    const result = await db.update(rooms)
      .set(updateData)
      .where(eq(rooms.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Sala não encontrada');
    }

    return result[0];
  })

  .delete('/:id', async ({ params }) => {
    const result = await db.delete(rooms)
      .where(eq(rooms.id, parseInt(params.id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Sala não encontrada');
    }

    return { message: 'Sala removida com sucesso' };
  });