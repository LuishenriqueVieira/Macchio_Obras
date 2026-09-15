ALTER TABLE `measurements` ADD `periodStart` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `startBp` integer;--> statement-breakpoint
ALTER TABLE `measurements` ADD `endBp` integer;--> statement-breakpoint
ALTER TABLE `measurements` ADD `amountCents` integer;--> statement-breakpoint
ALTER TABLE `measurements` ADD `contractCents` integer;--> statement-breakpoint
ALTER TABLE `measurements` ADD `stageName` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `contractor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `paid` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `paidAt` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `paymentHistory` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `cancelledAt` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `createdAt` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `stagesInitialized` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stages` ADD `contractCents` integer;--> statement-breakpoint
ALTER TABLE `stages` ADD `contractor` text DEFAULT '' NOT NULL;