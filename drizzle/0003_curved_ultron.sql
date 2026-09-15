CREATE TABLE `appUsers` (
	`id` text PRIMARY KEY NOT NULL,
	`identityId` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`activationHash` text,
	`activationExpiresAt` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appUsers_identityId_unique` ON `appUsers` (`identityId`);--> statement-breakpoint
CREATE UNIQUE INDEX `appUsers_email_unique` ON `appUsers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `appUsers_activationHash_unique` ON `appUsers` (`activationHash`);--> statement-breakpoint
CREATE TABLE `userAudit` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`actorId` text NOT NULL,
	`action` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `appUsers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actorId`) REFERENCES `appUsers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_userAudit_user` ON `userAudit` (`userId`);