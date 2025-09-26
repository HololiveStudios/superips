import { pgTable, serial, varchar, integer, boolean, timestamp, text, json } from 'drizzle-orm/pg-core';

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
  codigo_acesso: varchar('codigo_acesso', { length: 255 }),
  identificacao: varchar('identificacao', { length: 255 }),
  chave: varchar('chave', { length: 255 }),
  created_at: timestamp('createdAt').defaultNow(),
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

export type Device = typeof devices.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type DevicePosition = typeof devicePositions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Switch = typeof switches.$inferSelect;
export type Rack = typeof racks.$inferSelect;