CREATE TABLE `authSessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`authVersion` integer NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `appUsers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_authSessions_user` ON `authSessions` (`userId`);--> statement-breakpoint
CREATE TABLE `loginThrottle` (
	`id` text PRIMARY KEY NOT NULL,
	`startedAt` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loginThrottle_start` ON `loginThrottle` (`startedAt`);--> statement-breakpoint
ALTER TABLE `appUsers` ADD `username` text;--> statement-breakpoint
ALTER TABLE `appUsers` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `appUsers` ADD `authVersion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `appUsers_username_unique` ON `appUsers` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appUsers_login` ON `appUsers` (CASE WHEN "username" IS NULL THEN "email" ELSE "username" END);