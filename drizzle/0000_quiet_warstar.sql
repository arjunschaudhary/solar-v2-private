CREATE TABLE `solar_demo_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
