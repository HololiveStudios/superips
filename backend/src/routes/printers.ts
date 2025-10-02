import { Elysia } from 'elysia';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/database';
import { devices, rentalSettings } from '../db/schema';

export const printersRoutes = new Elysia({ prefix: '/api/printers' })

.post('/swap', async ({ body }) => {
  const {
    currentPrinterId,
    replacementPrinterId,
    currentPrinterReading,
    newFinalReading,
    isCurrentReserve,
    swapReason,
    swapDate
  } = body as any;

  if (!currentPrinterId || !replacementPrinterId || !swapReason) {
    throw new Error('Dados obrigatórios faltando');
  }

  if (currentPrinterReading <= 0) {
    throw new Error('Leitura deve ser maior que zero');
  }

  const [currentPrinter] = await db.select()
    .from(devices)
    .where(eq(devices.id, currentPrinterId));

  const [replacementPrinter] = await db.select()
    .from(devices)
    .where(eq(devices.id, replacementPrinterId));

  if (!currentPrinter || !replacementPrinter) {
    throw new Error('Impressora não encontrada');
  }

  let currentUpdate, replacementUpdate;

  if (isCurrentReserve) {
    // Reserva assume IP e dados do ativo
    currentUpdate = await db.update(devices)
      .set({
        ip: replacementPrinter.ip,
        sector: replacementPrinter.sector,
        user: replacementPrinter.user,
        model: replacementPrinter.model,
        npat: replacementPrinter.npat,
        li: currentPrinterReading,
        lf: newFinalReading || 0,
        updated_at: new Date()
      })
      .where(eq(devices.id, currentPrinterId))
      .returning();

    // Ativo vira reserva com motivo da troca no campo user
    replacementUpdate = await db.update(devices)
      .set({
        model: currentPrinter.model,
        npat: currentPrinter.npat,
        li: replacementPrinter.lf || 0,
        lf: replacementPrinter.lf || 0,
        sector: 'Almoxarifado',
        user: swapReason,
        updated_at: new Date()
      })
      .where(eq(devices.id, replacementPrinterId))
      .returning();
  } else {
    // Ativo recebe dados da reserva e mantém IP
    currentUpdate = await db.update(devices)
      .set({
        model: replacementPrinter.model,
        npat: replacementPrinter.npat,
        li: newFinalReading || replacementPrinter.li || 0,
        lf: currentPrinterReading,
        updated_at: new Date()
      })
      .where(eq(devices.id, currentPrinterId))
      .returning();

    // Reserva recebe dados do ativo com motivo da troca no campo user
    replacementUpdate = await db.update(devices)
      .set({
        model: currentPrinter.model,
        npat: currentPrinter.npat,
        li: currentPrinter.lf || 0,
        lf: currentPrinter.lf || 0,
        sector: 'Almoxarifado',
        user: swapReason,
        updated_at: new Date()
      })
      .where(eq(devices.id, replacementPrinterId))
      .returning();
  }

  if (!currentUpdate[0] || !replacementUpdate[0]) {
    throw new Error('Falha ao realizar troca');
  }

  return {
    currentPrinter: {
      ...currentUpdate[0],
      online: Number(currentUpdate[0].online) || 0,
      status: Number(currentUpdate[0].status) || 0,
      rental_type: currentUpdate[0].rental_type || 'Propria'
    },
    replacementPrinter: {
      ...replacementUpdate[0],
      online: Number(replacementUpdate[0].online) || 0,
      status: Number(replacementUpdate[0].status) || 0,
      rental_type: replacementUpdate[0].rental_type || 'Propria'
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
      npat,
      rental_type = 'Propria'
    } = body as any;

    const validRentalTypes = ['Propria', 'ArtCores', 'Mundial'];
    if (!validRentalTypes.includes(rental_type)) {
      throw new Error(`Invalid rental_type. Must be one of: ${validRentalTypes.join(', ')}`);
    }

    if (!npat) {
      throw new Error('N.PAT é obrigatório');
    }

    const result = await db.insert(devices)
      .values({
        name: name || null,
        ip: null,
        type: 'Impressora',
        online: 0,
        status: 0,
        sector: sector || null,
        model: model || null,
        user: user || null,
        npat: npat,
        li: 0,
        lf: 0,
        rental_type
      })
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to create reserve printer');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      status: Number(result[0].status) || 0,
      rental_type: result[0].rental_type || 'Propria'
    };
  })
  .get('/rental-settings', async () => {
    const result = await db.select()
      .from(rentalSettings)
      .orderBy(asc(rentalSettings.rental_type));

    return result.map(setting => ({
      ...setting,
      monthly_rental: Number(setting.monthly_rental),
      excess_cost_per_page: Number(setting.excess_cost_per_page)
    }));
  })

  .put('/rental-settings', async ({ body }) => {
    const settings = body as any;

    const validTypes = ['Propria', 'ArtCores', 'Mundial'];
    const results = [];

    for (const [rentalType, config] of Object.entries(settings)) {
      if (!validTypes.includes(rentalType)) continue;

      const settingData = config as any;
      
      const existing = await db.select()
        .from(rentalSettings)
        .where(eq(rentalSettings.rental_type, rentalType));

      let result;
      if (existing.length > 0) {
        result = await db.update(rentalSettings)
          .set({
            monthly_rental: settingData.monthlyRental.toString(),
            included_pages: settingData.includedPages,
            excess_cost_per_page: settingData.excessCostPerPage.toString(),
            updated_at: new Date()
          })
          .where(eq(rentalSettings.rental_type, rentalType))
          .returning();
      } else {
        result = await db.insert(rentalSettings)
          .values({
            rental_type: rentalType,
            monthly_rental: settingData.monthlyRental.toString(),
            included_pages: settingData.includedPages,
            excess_cost_per_page: settingData.excessCostPerPage.toString()
          })
          .returning();
      }

      if (result.length > 0 && result[0]) {
        results.push({
          ...result[0],
          monthly_rental: Number(result[0].monthly_rental),
          excess_cost_per_page: Number(result[0].excess_cost_per_page)
        });
      }
    }

    return { success: true, settings: results };
  })

  .get('/stats', async () => {
    const printers = await db.select()
      .from(devices)
      .where(eq(devices.type, 'Impressora'));

    const stats = printers.reduce((acc, printer) => {
      const rentalType = printer.rental_type || 'Propria';
      const pagesUsed = Math.max(0, (printer.lf || 0) - (printer.li || 0));

      if (!acc[rentalType]) {
        acc[rentalType] = {
          count: 0,
          totalPages: 0,
          onlineCount: 0
        };
      }

      acc[rentalType].count++;
      acc[rentalType].totalPages += pagesUsed;
      if (printer.online === 1) {
        acc[rentalType].onlineCount++;
      }

      return acc;
    }, {} as Record<string, any>);

    return {
      byType: stats,
      total: {
        count: printers.length,
        totalPages: printers.reduce((sum, p) => sum + Math.max(0, (p.lf || 0) - (p.li || 0)), 0),
        onlineCount: printers.filter(p => p.online === 1).length
      }
    };
  })

  .get('/', async () => {
    const result = await db.select()
      .from(devices)
      .where(eq(devices.type, 'Impressora'))
      .orderBy(asc(devices.sector), asc(devices.ip));

    return result.map(printer => ({
      ...printer,
      online: Number(printer.online) || 0,
      status: Number(printer.status) || 0,
      npat: printer.npat || 0,
      rental_type: printer.rental_type || 'Propria'
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
      lf,
      rental_type = 'Propria'
    } = body as any;

    const validRentalTypes = ['Propria', 'ArtCores', 'Mundial'];
    if (!validRentalTypes.includes(rental_type)) {
      throw new Error(`Invalid rental_type. Must be one of: ${validRentalTypes.join(', ')}`);
    }

    const current = await db.select({ ip: devices.ip })
      .from(devices)
      .where(eq(devices.id, parseInt(params.id)));

    if (current.length === 0) {
      throw new Error('Impressora não encontrada');
    }

    const oldIp = current[0]?.ip;

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
          lf: null,
          rental_type: null
        })
        .where(eq(devices.ip, oldIp));
    }

    const existing = await db.select({ id: devices.id })
      .from(devices)
      .where(eq(devices.ip, ip));

    let result;
    if (existing.length > 0 && existing[0]?.id !== parseInt(params.id)) {
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
          lf,
          rental_type
        })
        .where(eq(devices.ip, ip))
        .returning();
    } else {
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
          lf,
          rental_type
        })
        .where(eq(devices.id, parseInt(params.id)))
        .returning();
    }

    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to update printer');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      status: Number(result[0].status) || 0,
      rental_type: result[0].rental_type || 'Propria'
    };
  })

  .post('/:id/online', async ({ params, body }) => {
    const online = Number((body as any)?.online);

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

    if (result.length === 0 || !result[0]) {
      throw new Error('Printer not found');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      status: Number(result[0].status) || 0,
      rental_type: result[0].rental_type || 'Propria'
    };
  })

  .patch('/:id/rental-type', async ({ params, body }) => {
    const { rental_type } = body as any;

    const validRentalTypes = ['Propria', 'ArtCores', 'Mundial'];
    if (!validRentalTypes.includes(rental_type)) {
      throw new Error(`Invalid rental_type. Must be one of: ${validRentalTypes.join(', ')}`);
    }

    const result = await db.update(devices)
      .set({
        rental_type,
        updated_at: new Date()
      })
      .where(eq(devices.id, parseInt(params.id)))
      .returning();

    if (result.length === 0 || !result[0]) {
      throw new Error('Printer not found');
    }

    return {
      ...result[0],
      online: Number(result[0].online) || 0,
      status: Number(result[0].status) || 0,
      rental_type: result[0].rental_type || 'Propria'
    };
  });