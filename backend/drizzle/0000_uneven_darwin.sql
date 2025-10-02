CREATE TABLE IF NOT EXISTS "annual_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"year" integer NOT NULL,
	"category" varchar(100),
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'not-started',
	"progress_percentage" integer DEFAULT 0,
	"target_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"created_by" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"time" varchar(5) NOT NULL,
	"days" text NOT NULL,
	"category" varchar(100),
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"notification_enabled" boolean DEFAULT true,
	"notification_minutes_before" integer DEFAULT 15,
	"completed_today" boolean DEFAULT false,
	"last_completed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer,
	"room_id" integer,
	"x" integer,
	"y" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" varchar(15),
	"name" varchar(255),
	"type" varchar(100),
	"user" varchar(255),
	"sector" varchar(255),
	"status" integer,
	"online" integer,
	"model" varchar(255),
	"login_username" varchar(255),
	"login_password" varchar(255),
	"wifi_ssid" varchar(255),
	"wifi_password" varchar(255),
	"hidden" boolean,
	"npat" integer,
	"li" integer,
	"lf" integer,
	"rental_type" varchar(20) DEFAULT 'Propria',
	"codigo_acesso" varchar(255),
	"identificacao" varchar(255),
	"chave" varchar(255),
	"createdAt" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goal_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_date" timestamp,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "racks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"sector" varchar(255),
	"total_units" integer,
	"used_units" integer,
	"location" varchar(255),
	"status" varchar(50),
	"createdAt" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rental_type" varchar(50) NOT NULL,
	"monthly_rental" numeric(10, 2) NOT NULL,
	"included_pages" integer NOT NULL,
	"excess_cost_per_page" numeric(10, 4) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rental_settings_rental_type_unique" UNIQUE("rental_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"x" integer,
	"y" integer,
	"width" integer,
	"height" integer,
	"floor" integer,
	"createdAt" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scales" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"ip" text,
	"type" text DEFAULT 'Balança',
	"online" integer DEFAULT 0,
	"sector" text,
	"model" text,
	"user" text,
	"npat" text,
	"defect_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "switches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"model" varchar(255),
	"sector" varchar(255),
	"rack_position" integer,
	"total_ports" integer,
	"used_ports" integer,
	"is_poe" boolean,
	"status" varchar(50),
	"ip_address" varchar(15),
	"ports_status" json,
	"createdAt" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"device_id" integer,
	"action_type" varchar(100),
	"completed" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"resource_type" varchar(50),
	"resource_id" integer,
	"action_description" text,
	"completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"description" text,
	"priority" varchar(50),
	"status" varchar(50),
	"category" varchar(100),
	"due_date" timestamp,
	"assigned_to" varchar(255),
	"createdAt" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_positions" ADD CONSTRAINT "device_positions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_positions" ADD CONSTRAINT "device_positions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_annual_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "annual_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_devices" ADD CONSTRAINT "task_devices_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_devices" ADD CONSTRAINT "task_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_resources" ADD CONSTRAINT "task_resources_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
