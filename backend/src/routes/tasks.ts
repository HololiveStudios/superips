import { Elysia } from 'elysia';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/database';
import { tasks } from '../db/schema';

export const tasksRoutes = new Elysia({ prefix: '/api/tasks' })
  .get('/', async () => {
    return await db.select().from(tasks).orderBy(desc(tasks.created_at));
  })

  .post('/', async ({ body }) => {
    const { title, description, priority, category, due_date, assigned_to } = body as any;
    
    const result = await db.insert(tasks)
      .values({
        title,
        description,
        priority,
        category,
        due_date: due_date ? new Date(due_date) : null,
        assigned_to
      })
      .returning();

    return result[0];
  })

  .put('/:id', async ({ params, body }) => {
    const { title, description, priority, status, category, due_date, assigned_to } = body as any;
    
    const result = await db.update(tasks)
      .set({
        title,
        description,
        priority,
        status,
        category,
        due_date: due_date ? new Date(due_date) : null,
        assigned_to,
        updated_at: new Date()
      })
      .where(eq(tasks.id, parseInt(params.id)))
      .returning();

    return result[0];
  })

  .delete('/:id', async ({ params }) => {
    await db.delete(tasks).where(eq(tasks.id, parseInt(params.id)));
    return { message: 'Task deleted' };
  });