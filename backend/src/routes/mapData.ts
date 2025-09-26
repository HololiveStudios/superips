import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { rooms, devices, devicePositions } from '../db/schema';

export const mapDataRoutes = new Elysia({ prefix: '/api/map-data' })
  .get('/', async ({ query }) => {
    const { floor } = query;
    
    let roomsQuery = db.select().from(rooms).orderBy(asc(rooms.id));
    let roomsResult: any[];
    
    if (floor) {
      roomsResult = await db.select().from(rooms).where(eq(rooms.floor, parseInt(floor as string))).orderBy(asc(rooms.name));
    } else {
      roomsResult = await roomsQuery;
    }

    const devicesResult = await db.select().from(devices).orderBy(asc(devices.id));
    
    let positionsResult: any[];
    if (floor) {
      positionsResult = await db
        .select({
          id: devicePositions.id,
          device_id: devicePositions.device_id,
          room_id: devicePositions.room_id,
          x: devicePositions.x,
          y: devicePositions.y,
          floor: rooms.floor
        })
        .from(devicePositions)
        .leftJoin(rooms, eq(devicePositions.room_id, rooms.id))
        .where(eq(rooms.floor, parseInt(floor as string)));
    } else {
      positionsResult = await db
        .select({
          id: devicePositions.id,
          device_id: devicePositions.device_id,
          room_id: devicePositions.room_id,
          x: devicePositions.x,
          y: devicePositions.y,
          floor: rooms.floor
        })
        .from(devicePositions)
        .leftJoin(rooms, eq(devicePositions.room_id, rooms.id));
    }

    const spacing = 80;
    const cols = 5;

    const devicesWithPositions = devicesResult
      .map((device, index) => {
        const position = positionsResult.find(p => p.device_id === device.id);

        let x, y;

        if (position) {
          x = position.x;
          y = position.y;
        } else {
          x = 50 + (index % cols) * spacing;
          y = 50 + Math.floor(index / cols) * spacing;
        }

        return {
          ...device,
          room_id: position?.room_id || null,
          x,
          y,
          status: Number(device.status) === 1 ? 1 : 0
        };
      })
      .filter(device => device.ip?.startsWith('10.0.11.'));

    const sectors = [...new Set(devicesResult.map(d => d.sector).filter(Boolean))];
    const deviceTypes = [...new Set(devicesResult.map(d => d.type).filter(Boolean))];

    return {
      rooms: roomsResult,
      devices: devicesWithPositions,
      sectors,
      device_types: deviceTypes
    };
  });