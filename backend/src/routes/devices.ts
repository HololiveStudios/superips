import { Elysia, t } from 'elysia';
import { eq, asc, or } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';
import { isDeviceReallyFree, isFieldEmpty } from '../utils';
import * as XLSX from 'xlsx';
import type { AvailableIPsResponse, ImportSummary } from '../types';

export const devicesRoutes = new Elysia({ prefix: '/api/devices' })
  .get('/available-ips', async ({ query }) => {
    const networks = ['10.0.11', '10.2.11', '10.4.11'];
    const { network } = query;
    
    const allDevices = await db.select().from(devices).orderBy(asc(devices.ip));
    const available = [];
    const networksToCheck = network ? [network as string] : networks;

    for (const net of networksToCheck) {
      for (let i = 1; i <= 254; i++) {
        const ip = `${net}.${i}`;
        const device = allDevices.find(d => d.ip === ip);

        if (!device) {
          available.push({
            ip,
            status: 'não_cadastrado' as const,
            reason: 'IP não encontrado no banco de dados'
          });
        } else {
          if (isDeviceReallyFree(device)) {
            available.push({
              ip,
              status: 'livre' as const,
              reason: 'Todos os campos estão vazios',
              device_status: device.status === 0 ? 'offline' as const : 'online' as const
            });
          }
        }
      }
    }

    const stats: Record<string, any> = {};
    for (const net of networks) {
      const networkIPs = available.filter(item => item.ip.startsWith(net));
      const totalDevicesInNetwork = allDevices.filter(d => d.ip?.startsWith(net)).length;
      
      stats[net] = {
        available_count: networkIPs.length,
        total_devices: totalDevicesInNetwork,
        usage_percentage: ((totalDevicesInNetwork / 254) * 100).toFixed(1)
      };
    }

    return {
      available,
      stats,
      total_available: available.length,
      networks
    } as AvailableIPsResponse;
  })
  
  .get('/check-ip/:ip', async ({ params }) => {
    const result = await db.select().from(devices).where(eq(devices.ip, params.ip));

    if (result.length === 0) {
      return {
        ip: params.ip,
        status: 'não_cadastrado',
        available: true,
        message: 'IP não encontrado no banco de dados'
      };
    }

    const device = result[0];
    if (!device) {
      return {
        ip: params.ip,
        status: 'não_cadastrado',
        available: true,
        message: 'IP não encontrado no banco de dados'
      };
    }

    const isFree = isDeviceReallyFree(device);

    return {
      ip: params.ip,
      status: isFree ? 'livre' : 'ocupado',
      available: isFree,
      device,
      message: isFree ? 'IP disponível para uso' : 'IP já está em uso',
      details: {
        name_empty: isFieldEmpty(device.name),
        type_empty: isFieldEmpty(device.type),
        user_empty: isFieldEmpty(device.user),
        sector_empty: isFieldEmpty(device.sector)
      }
    };
  })

  .get('/', async () => {
    return await db.select().from(devices).orderBy(asc(devices.ip));
  })

  .post('/', async ({ body }) => {
    const { ip, name, type, user, sector } = body as any;
    const result = await db.insert(devices).values({
      ip, name, type, user, sector
    }).returning();
    return result[0];
  })

  .put('/:id', async ({ params, body }) => {
    const { ip, name, type, user, sector } = body as any;
    const result = await db.update(devices)
      .set({ ip, name, type, user, sector })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();
    return result[0];
  })

  .delete('/:id', async ({ params }) => {
    await db.delete(devices).where(eq(devices.id, parseInt(params.id)));
    return { message: 'Device deleted' };
  })

  .post('/import', async ({ body }) => {
    const form = body as any;
    const file = form.file;
    
    if (!file) throw new Error('Arquivo não enviado');

    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    interface ImportRows { devices?: any[] }

    let rows: any[] = [];

    const name = file.name?.toLowerCase() || '';
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isJson = name.endsWith('.json');

    if (isXlsx) {
      const workbook = XLSX.read(uint8Array, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
    } else if (isJson) {
      const text = new TextDecoder().decode(uint8Array);
      const parsed = JSON.parse(text) as any;

      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed?.devices && Array.isArray(parsed.devices)) {
        rows = parsed.devices;
      } else {
        throw new Error('JSON inválido: esperar array de objetos ou { devices: [] }');
      }
    }
    
    const normalize = (obj: any) => {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k.toString().trim().toLowerCase()] = obj[k];
      }
      return out;
    };

    const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0, errors: [] };

    for (const rawRow of rows) {
      const r = normalize(rawRow);

      const id = r.id ? Number(r.id) : null;
      const ip = r.ip ?? r.ip_address ?? r.endereco ?? r.address ?? null;
      const name = r.name ?? r.nome ?? r.device_name ?? null;
      const type = r.type ?? r.tipo ?? null;
      const user = r.user ?? r.usuario ?? r.owner ?? null;
      const sector = r.sector ?? r.setor ?? r.department ?? null;
      const status = r.status !== undefined && r.status !== null ? (Number(r.status) || 0) : null;
      const online = r.online !== undefined && r.online !== null ? (Number(r.online) || 0) : null;

      if (!id && !ip && !name) {
        summary.skipped++;
        continue;
      }

      try {
        if (ip) {
          const existing = await db.select().from(devices).where(eq(devices.ip, ip));
          
          if (existing.length > 0) {
            await db.update(devices)
              .set({ name, type, user, sector, status, online })
              .where(eq(devices.ip, ip));
            summary.updated++;
          } else {
            await db.insert(devices).values({
              ip, name, type, user, sector, status, online
            });
            summary.inserted++;
          }
        } else {
          await db.insert(devices).values({
            ip, name, type, user, sector, status, online
          });
          summary.inserted++;
        }
      } catch (error) {
        summary.errors.push({ 
          row: rawRow, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { success: true, summary };
  })

  .get('/export', async () => {
    const result = await db.select().from(devices);

    if (result.length === 0) {
      throw new Error('Nenhum dispositivo encontrado');
    }

    const ws = XLSX.utils.json_to_sheet(result);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Devices');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="devices.xlsx"'
      }
    });
  });