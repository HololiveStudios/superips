import { pgTable, serial, varchar, integer, boolean, timestamp, text, json, decimal } from 'drizzle-orm/pg-core';

export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  ip: varchar('ip', { length: 15 }),
  name: varchar('name', { length: 255 }),
  type: varchar('type', { length: 100 }),
  user: varchar('user', { length: 255 }),
  sector: varchar('sector', { length: 255 }),
  status: integer('status'),
  online: integer('online'),
  model: varchar('model', { length: 255 }),
  login_username: varchar('login_username', { length: 255 }),
  login_password: varchar('login_password', { length: 255 }),
  wifi_ssid: varchar('wifi_ssid', { length: 255 }),
  wifi_password: varchar('wifi_password', { length: 255 }),
  hidden: boolean('hidden'),
  npat: integer('npat'),
  li: integer('li'),
  lf: integer('lf'),
  rental_type: varchar('rental_type', { length: 20 }).default('Propria'),
  codigo_acesso: varchar('codigo_acesso', { length: 255 }),
  identificacao: varchar('identificacao', { length: 255 }),
  chave: varchar('chave', { length: 255 }),
  created_at: timestamp('createdAt').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const scales = pgTable('scales', {
  id: serial('id').primaryKey(),
  name: text('name'),
  ip: text('ip'),
  type: text('type').default('Balança'),
  online: integer('online').default(0),
  sector: text('sector'),
  model: text('model'),
  user: text('user'),
  npat: text('npat'),
  defect_reason: text('defect_reason'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

export const rentalSettings = pgTable('rental_settings', {
  id: serial('id').primaryKey(),
  rental_type: varchar('rental_type', { length: 50 }).notNull().unique(),
  monthly_rental: decimal('monthly_rental', { precision: 10, scale: 2 }).notNull(),
  included_pages: integer('included_pages').notNull(),
  excess_cost_per_page: decimal('excess_cost_per_page', { precision: 10, scale: 4 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
 
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  x: integer('x'),
  y: integer('y'),
  width: integer('width'),
  height: integer('height'),
  floor: integer('floor'),
  created_at: timestamp('createdAt').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const devicePositions = pgTable('device_positions', {
  id: serial('id').primaryKey(),
  device_id: integer('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  room_id: integer('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
  x: integer('x'),
  y: integer('y'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  priority: varchar('priority', { length: 50 }),
  status: varchar('status', { length: 50 }),
  category: varchar('category', { length: 100 }),
  due_date: timestamp('due_date'),
  assigned_to: varchar('assigned_to', { length: 255 }),
  created_at: timestamp('createdAt').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const dailyTasks = pgTable('daily_tasks', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  time: varchar('time', { length: 5 }).notNull(),
  days: text('days').notNull(),
  category: varchar('category', { length: 100 }),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  notification_enabled: boolean('notification_enabled').default(true),
  notification_minutes_before: integer('notification_minutes_before').default(15),
  completed_today: boolean('completed_today').default(false),
  last_completed: timestamp('last_completed'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

export const switches = pgTable('switches', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  model: varchar('model', { length: 255 }),
  sector: varchar('sector', { length: 255 }),
  rack_position: integer('rack_position'),
  total_ports: integer('total_ports'),
  used_ports: integer('used_ports'),
  is_poe: boolean('is_poe'),
  status: varchar('status', { length: 50 }),
  ip_address: varchar('ip_address', { length: 15 }),
  ports_status: json('ports_status'),
  created_at: timestamp('createdAt').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const racks = pgTable('racks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  sector: varchar('sector', { length: 255 }),
  total_units: integer('total_units'),
  used_units: integer('used_units'),
  location: varchar('location', { length: 255 }),
  status: varchar('status', { length: 50 }),
  created_at: timestamp('createdAt').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const annualGoals = pgTable('annual_goals', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  year: integer('year').notNull(),
  category: varchar('category', { length: 100 }),
  priority: varchar('priority', { length: 20 }).default('medium'),
  status: varchar('status', { length: 50 }).default('not-started'), // not-started, in-progress, completed, cancelled
  progress_percentage: integer('progress_percentage').default(0),
  target_completion_date: timestamp('target_completion_date'),
  actual_completion_date: timestamp('actual_completion_date'),
  created_by: varchar('created_by', { length: 255 }),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

export const taskDevices = pgTable('task_devices', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  device_id: integer('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  action_type: varchar('action_type', { length: 100 }), // formatar, configurar, atualizar, instalar, etc
  completed: boolean('completed').default(false),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow()
});

export const goalMilestones = pgTable('goal_milestones', {
  id: serial('id').primaryKey(),
  goal_id: integer('goal_id').references(() => annualGoals.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  target_date: timestamp('target_date'),
  completed: boolean('completed').default(false),
  completed_at: timestamp('completed_at'),
  order_index: integer('order_index').default(0),
  created_at: timestamp('created_at').defaultNow()
});

export const taskResources = pgTable('task_resources', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  resource_type: varchar('resource_type', { length: 50 }), // printer, scale, switch, router, box
  resource_id: integer('resource_id'),
  action_description: text('action_description'),
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at').defaultNow()
});

export type AnnualGoal = typeof annualGoals.$inferSelect;
export type TaskDevice = typeof taskDevices.$inferSelect;
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type TaskResource = typeof taskResources.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type RentalSetting = typeof rentalSettings.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type DevicePosition = typeof devicePositions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Switch = typeof switches.$inferSelect;
export type Rack = typeof racks.$inferSelect;