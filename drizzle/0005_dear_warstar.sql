CREATE TABLE `systemSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `appUsers` ADD `deletedAt` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `editHistory` text DEFAULT '[]' NOT NULL;