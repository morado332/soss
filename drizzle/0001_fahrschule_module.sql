CREATE TABLE "fs_instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"license_classes" text DEFAULT 'B' NOT NULL,
	"color" text DEFAULT '#4f46e5' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fs_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"type" text DEFAULT 'normal' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"invoice_id" uuid,
	"notes" text,
	"reminded_24h_at" timestamp with time zone,
	"reminded_1h_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fs_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"license_class" text DEFAULT 'B' NOT NULL,
	"instructor_id" uuid,
	"req_normal" integer DEFAULT 20 NOT NULL,
	"req_ueberland" integer DEFAULT 5 NOT NULL,
	"req_autobahn" integer DEFAULT 4 NOT NULL,
	"req_nacht" integer DEFAULT 3 NOT NULL,
	"theory_progress" integer DEFAULT 0 NOT NULL,
	"theory_external_id" text,
	"theory_synced_at" timestamp with time zone,
	"theory_passed" boolean DEFAULT false NOT NULL,
	"practical_passed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fs_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plate" text NOT NULL,
	"license_class" text DEFAULT 'B' NOT NULL,
	"transmission" text DEFAULT 'manual' NOT NULL,
	"next_service" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminded_24h_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminded_1h_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fs_instructors" ADD CONSTRAINT "fs_instructors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_lessons" ADD CONSTRAINT "fs_lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_lessons" ADD CONSTRAINT "fs_lessons_student_id_fs_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."fs_students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_lessons" ADD CONSTRAINT "fs_lessons_instructor_id_fs_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."fs_instructors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_lessons" ADD CONSTRAINT "fs_lessons_vehicle_id_fs_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fs_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_lessons" ADD CONSTRAINT "fs_lessons_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_students" ADD CONSTRAINT "fs_students_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_students" ADD CONSTRAINT "fs_students_instructor_id_fs_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."fs_instructors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fs_vehicles" ADD CONSTRAINT "fs_vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fs_instructors_tenant" ON "fs_instructors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_fs_lessons_tenant_time" ON "fs_lessons" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_fs_lessons_student" ON "fs_lessons" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_fs_students_tenant" ON "fs_students" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_fs_vehicles_tenant" ON "fs_vehicles" USING btree ("tenant_id");