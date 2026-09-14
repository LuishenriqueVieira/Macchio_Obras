CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text NOT NULL,
	`key` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_project` ON `documents` (`projectId`);--> statement-breakpoint
CREATE TABLE `engineers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`crea` text NOT NULL,
	`specialty` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`stageId` text NOT NULL,
	`date` text NOT NULL,
	`quantity` real NOT NULL,
	`unitPrice` real NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stageId`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_measurements_stage` ON `measurements` (`stageId`);--> statement-breakpoint
CREATE INDEX `idx_measurements_project` ON `measurements` (`projectId`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text NOT NULL,
	`address` text NOT NULL,
	`engineerId` text,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`budget` real NOT NULL,
	`status` text NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`engineerId`) REFERENCES `engineers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stages_project` ON `stages` (`projectId`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`leader` text NOT NULL,
	`trade` text NOT NULL,
	`members` text NOT NULL,
	`projectId` text,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_teams_project` ON `teams` (`projectId`);