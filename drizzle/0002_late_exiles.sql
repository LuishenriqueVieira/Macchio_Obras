CREATE TABLE `stageTypes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nameKey` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stageTypes_nameKey_unique` ON `stageTypes` (`nameKey`);--> statement-breakpoint
ALTER TABLE `stages` ADD `stageTypeId` text REFERENCES stageTypes(id);