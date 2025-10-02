import { Elysia, t } from 'elysia';
import { db } from '../db/database';
import { taskDevices, taskResources, devices, tasks } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

export const taskDevicesRoutes = new Elysia({ prefix: '/task-devices' })
  // Associar dispositivos a uma tarefa
  .post('/', async ({ body }) => {
    const associations = await Promise.all(
      body.device_ids.map(async (deviceId) => {
        const [assoc] = await db.insert(taskDevices)
          .values({
            task_id: body.task_id,
            device_id: deviceId,
            action_type: body.action_type,
            notes: body.notes
          })
          .returning();
        return assoc;
      })
    );
    
    return associations;
  }, {
    body: t.Object({
      task_id: t.Number(),
      device_ids: t.Array(t.Number()),
      action_type: t.String(),
      notes: t.Optional(t.String())
    })
  })

  // Buscar dispositivos de uma tarefa
  .get('/task/:taskId', async ({ params }) => {
    const taskDevicesList = await db.select({
      id: taskDevices.id,
      task_id: taskDevices.task_id,
      device_id: taskDevices.device_id,
      action_type: taskDevices.action_type,
      completed: taskDevices.completed,
      notes: taskDevices.notes,
      device_name: devices.name,
      device_ip: devices.ip,
      device_type: devices.type,
      device_sector: devices.sector,
      device_user: devices.user
    })
    .from(taskDevices)
    .leftJoin(devices, eq(taskDevices.device_id, devices.id))
    .where(eq(taskDevices.task_id, parseInt(params.taskId)));

    return taskDevicesList;
  })

  // Marcar dispositivo como concluído
  .patch('/:id/complete', async ({ params, body }) => {
    const [updated] = await db.update(taskDevices)
      .set({
        completed: body.completed,
        notes: body.notes || null
      })
      .where(eq(taskDevices.id, parseInt(params.id)))
      .returning();

    return updated;
  }, {
    body: t.Object({
      completed: t.Boolean(),
      notes: t.Optional(t.String())
    })
  })

  // Remover associação
  .delete('/:id', async ({ params }) => {
    await db.delete(taskDevices)
      .where(eq(taskDevices.id, parseInt(params.id)));
    
    return { message: 'Associação removida' };
  })

  // Associar recursos (impressoras, balanças, etc) a tarefas
  .post('/resources', async ({ body }) => {
    const [resource] = await db.insert(taskResources)
      .values({
        task_id: body.task_id,
        resource_type: body.resource_type,
        resource_id: body.resource_id,
        action_description: body.action_description
      })
      .returning();
    
    return resource;
  }, {
    body: t.Object({
      task_id: t.Number(),
      resource_type: t.String(),
      resource_id: t.Number(),
      action_description: t.Optional(t.String())
    })
  })

  // Buscar recursos de uma tarefa
  .get('/resources/task/:taskId', async ({ params }) => {
    const resources = await db.select()
      .from(taskResources)
      .where(eq(taskResources.task_id, parseInt(params.taskId)));

    return resources;
  })

  // Marcar recurso como concluído
  .patch('/resources/:id/complete', async ({ params }) => {
    const [updated] = await db.update(taskResources)
      .set({ completed: true })
      .where(eq(taskResources.id, parseInt(params.id)))
      .returning();

    return updated;
  })

  // Deletar recurso
  .delete('/resources/:id', async ({ params }) => {
    await db.delete(taskResources)
      .where(eq(taskResources.id, parseInt(params.id)));
    
    return { message: 'Recurso removido' };
  })

  // Buscar tarefas de um dispositivo específico
  .get('/device/:deviceId', async ({ params }) => {
    const deviceTasks = await db.select({
      id: taskDevices.id,
      task_id: taskDevices.task_id,
      action_type: taskDevices.action_type,
      completed: taskDevices.completed,
      notes: taskDevices.notes,
      task_title: tasks.title,
      task_description: tasks.description,
      task_status: tasks.status,
      task_priority: tasks.priority,
      task_due_date: tasks.due_date
    })
    .from(taskDevices)
    .leftJoin(tasks, eq(taskDevices.task_id, tasks.id))
    .where(eq(taskDevices.device_id, parseInt(params.deviceId)));

    return deviceTasks;
  })

  // Relatório de dispositivos mais usados em tarefas
  .get('/stats/most-used', async () => {
    const allAssociations = await db.select({
      device_id: taskDevices.device_id,
      device_name: devices.name,
      device_type: devices.type
    })
    .from(taskDevices)
    .leftJoin(devices, eq(taskDevices.device_id, devices.id));

    const deviceCounts = allAssociations.reduce((acc, item) => {
      const key = item.device_id;
      if (!acc[key]) {
        acc[key] = {
          device_id: item.device_id,
          device_name: item.device_name,
          device_type: item.device_type,
          count: 0
        };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<number, any>);

    return Object.values(deviceCounts).sort((a: any, b: any) => b.count - a.count);
  })

  // Buscar ações disponíveis por tipo de dispositivo
  .get('/actions/:deviceType', async ({ params }) => {
    const actionsByType: Record<string, string[]> = {
      'Computador': ['Formatar', 'Atualizar Windows', 'Instalar Software', 'Limpeza Física', 'Configurar Rede', 'Backup'],
      'Impressora': ['Configurar', 'Trocar Toner', 'Manutenção', 'Instalar Driver', 'Configurar Compartilhamento'],
      'Balança': ['Calibrar', 'Atualizar Firmware', 'Configurar', 'Manutenção Preventiva'],
      'Switch': ['Configurar VLANs', 'Atualizar Firmware', 'Mapear Portas', 'Verificar Conectividade'],
      'Roteador': ['Configurar', 'Atualizar Firmware', 'Otimizar WiFi', 'Configurar Firewall'],
      'Caixa': ['Atualizar Sistema', 'Configurar Periféricos', 'Manutenção', 'Backup']
    };

    return actionsByType[params.deviceType] || ['Configurar', 'Manutenção', 'Atualizar'];
  });