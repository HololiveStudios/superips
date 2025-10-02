import { Elysia, t } from 'elysia';
import { db } from '../db/database';
import { annualGoals, goalMilestones } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const annualGoalsRoutes = new Elysia({ prefix: '/annual-goals' })
  // Listar todas as metas
  .get('/', async () => {
    const goals = await db.select().from(annualGoals).orderBy(desc(annualGoals.year), desc(annualGoals.created_at));
    return goals;
  })

  // Buscar metas por ano
  .get('/year/:year', async ({ params }) => {
    const goals = await db.select()
      .from(annualGoals)
      .where(eq(annualGoals.year, parseInt(params.year)))
      .orderBy(desc(annualGoals.priority));
    return goals;
  })

  // Buscar meta específica com milestones
  .get('/:id', async ({ params }) => {
    const goal = await db.select()
      .from(annualGoals)
      .where(eq(annualGoals.id, parseInt(params.id)))
      .limit(1);
    
    if (goal.length === 0) {
      throw new Error('Meta não encontrada');
    }

    const milestones = await db.select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goal_id, parseInt(params.id)))
      .orderBy(goalMilestones.order_index);

    return {
      ...goal[0],
      milestones
    };
  })

  // Criar nova meta
  .post('/', async ({ body }) => {
    const [newGoal] = await db.insert(annualGoals)
      .values({
        title: body.title,
        description: body.description,
        year: body.year,
        category: body.category,
        priority: body.priority,
        target_completion_date: body.target_completion_date ? new Date(body.target_completion_date) : null,
        created_by: body.created_by,
        notes: body.notes
      })
      .returning();
    
    return newGoal;
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      year: t.Number(),
      category: t.Optional(t.String()),
      priority: t.Optional(t.String()),
      target_completion_date: t.Optional(t.String()),
      created_by: t.Optional(t.String()),
      notes: t.Optional(t.String())
    })
  })

  // Atualizar meta
  .put('/:id', async ({ params, body }) => {
    const [updated] = await db.update(annualGoals)
      .set({
        ...body,
        updated_at: new Date()
      })
      .where(eq(annualGoals.id, parseInt(params.id)))
      .returning();
    
    return updated;
  })

  // Atualizar progresso
  .patch('/:id/progress', async ({ params, body }) => {
    const [updated] = await db.update(annualGoals)
      .set({
        progress_percentage: body.progress,
        status: body.progress === 100 ? 'completed' : 'in-progress',
        actual_completion_date: body.progress === 100 ? new Date() : null,
        updated_at: new Date()
      })
      .where(eq(annualGoals.id, parseInt(params.id)))
      .returning();
    
    return updated;
  }, {
    body: t.Object({
      progress: t.Number()
    })
  })

  // Deletar meta
  .delete('/:id', async ({ params }) => {
    await db.delete(annualGoals)
      .where(eq(annualGoals.id, parseInt(params.id)));
    
    return { message: 'Meta deletada com sucesso' };
  })

  // Adicionar milestone
  .post('/:id/milestones', async ({ params, body }) => {
    const [milestone] = await db.insert(goalMilestones)
      .values({
        goal_id: parseInt(params.id),
        title: body.title,
        description: body.description,
        target_date: body.target_date ? new Date(body.target_date) : null,
        order_index: body.order_index || 0
      })
      .returning();
    
    return milestone;
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      target_date: t.Optional(t.String()),
      order_index: t.Optional(t.Number())
    })
  })

  // Completar milestone
  .post('/:goalId/milestones/:milestoneId/complete', async ({ params }) => {
    const [milestone] = await db.update(goalMilestones)
      .set({
        completed: true,
        completed_at: new Date()
      })
      .where(eq(goalMilestones.id, parseInt(params.milestoneId)))
      .returning();

    // Recalcular progresso da meta
    const allMilestones = await db.select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goal_id, parseInt(params.goalId)));

    const completedCount = allMilestones.filter(m => m.completed).length;
    const progress = Math.round((completedCount / allMilestones.length) * 100);

    await db.update(annualGoals)
      .set({
        progress_percentage: progress,
        status: progress === 100 ? 'completed' : 'in-progress',
        updated_at: new Date()
      })
      .where(eq(annualGoals.id, parseInt(params.goalId)));

    return milestone;
  })

  // Deletar milestone
  .delete('/milestones/:id', async ({ params }) => {
    await db.delete(goalMilestones)
      .where(eq(goalMilestones.id, parseInt(params.id)));
    
    return { message: 'Milestone deletado' };
  })

  // Estatísticas
  .get('/stats/overview', async () => {
    const currentYear = new Date().getFullYear();
    const allGoals = await db.select().from(annualGoals);
    const currentYearGoals = allGoals.filter(g => g.year === currentYear);

    return {
      total: allGoals.length,
      current_year: currentYearGoals.length,
      completed: currentYearGoals.filter(g => g.status === 'completed').length,
      in_progress: currentYearGoals.filter(g => g.status === 'in-progress').length,
      not_started: currentYearGoals.filter(g => g.status === 'not-started').length,
      average_progress: Math.round(
        currentYearGoals.reduce((acc, g) => acc + (g.progress_percentage || 0), 0) / 
        (currentYearGoals.length || 1)
      )
    };
  });