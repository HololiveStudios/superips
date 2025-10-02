import { Elysia } from 'elysia';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/database';
import { dailyTasks } from '../db/schema';

export const dailyTasksRoutes = new Elysia({ prefix: '/api/daily-tasks' })
  .get('/', async () => {
    const tasks = await db.select().from(dailyTasks).orderBy(desc(dailyTasks.created_at));
    return tasks.map(task => ({
      ...task,
      days: JSON.parse(task.days)
    }));
  })

  .get('/day/:day', async ({ params }) => {
    const allTasks = await db.select().from(dailyTasks);
    return allTasks
      .filter(task => JSON.parse(task.days).includes(params.day))
      .map(task => ({
        ...task,
        days: JSON.parse(task.days)
      }));
  })

  .post('/', async ({ body }) => {
    const { 
      title, 
      description, 
      time, 
      days, 
      category, 
      priority,
      notification_enabled,
      notification_minutes_before 
    } = body as any;
    
    const result = await db.insert(dailyTasks)
      .values({
        title,
        description,
        time,
        days: JSON.stringify(days),
        category,
        priority,
        notification_enabled: notification_enabled ?? true,
        notification_minutes_before: notification_minutes_before ?? 15,
        completed_today: false
      })
      .returning();

    if (!result[0]) throw new Error('Failed to create task');
    return { ...result[0], days: JSON.parse(result[0].days) };
  })

  .put('/:id', async ({ params, body }) => {
    const { 
      title, 
      description, 
      time, 
      days, 
      category, 
      priority,
      notification_enabled,
      notification_minutes_before 
    } = body as any;
    
    const updateData: any = {
      updated_at: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (time !== undefined) updateData.time = time;
    if (days !== undefined) updateData.days = JSON.stringify(days);
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;
    if (notification_enabled !== undefined) updateData.notification_enabled = notification_enabled;
    if (notification_minutes_before !== undefined) updateData.notification_minutes_before = notification_minutes_before;
    
    const result = await db.update(dailyTasks)
      .set(updateData)
      .where(eq(dailyTasks.id, parseInt(params.id)))
      .returning();

    if (!result[0]) throw new Error('Task not found');
    return { ...result[0], days: JSON.parse(result[0].days) };
  })

  .post('/:id/toggle', async ({ params }) => {
    const task = await db.select().from(dailyTasks)
      .where(eq(dailyTasks.id, parseInt(params.id)))
      .limit(1);

    if (!task[0]) throw new Error('Task not found');

    const result = await db.update(dailyTasks)
      .set({
        completed_today: !task[0].completed_today,
        last_completed: !task[0].completed_today ? new Date() : task[0].last_completed
      })
      .where(eq(dailyTasks.id, parseInt(params.id)))
      .returning();

    if (!result[0]) throw new Error('Failed to update task');
    return { ...result[0], days: JSON.parse(result[0].days) };
  })

  .post('/reset-completion', async () => {
    const result = await db.update(dailyTasks)
      .set({ completed_today: false })
      .returning();

    return { success: true, reset_count: result.length };
  })

  .delete('/:id', async ({ params }) => {
    await db.delete(dailyTasks).where(eq(dailyTasks.id, parseInt(params.id)));
    return { message: 'Daily task deleted' };
  });