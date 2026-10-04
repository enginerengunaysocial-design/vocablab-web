CREATE TABLE `ad_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotKey` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`type` varchar(24) NOT NULL DEFAULT 'placeholder',
	`content` text NOT NULL,
	`adsenseClient` varchar(120) NOT NULL DEFAULT '',
	`adsenseSlot` varchar(120) NOT NULL DEFAULT '',
	`videoUrl` varchar(500) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_slots_slotKey_unique` UNIQUE(`slotKey`)
);
--> statement-breakpoint
CREATE TABLE `visit_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visit_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_stats_day_unique` UNIQUE(`dayKey`)
);
--> statement-breakpoint
CREATE TABLE `vocab_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grade` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vocab_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `vocab_classes_grade_unique` UNIQUE(`grade`)
);
--> statement-breakpoint
CREATE TABLE `vocab_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`unitNumber` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vocab_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `vocab_units_class_unit_unique` UNIQUE(`classId`,`unitNumber`)
);
--> statement-breakpoint
CREATE TABLE `vocab_words` (
	`id` int AUTO_INCREMENT NOT NULL,
	`unitId` int NOT NULL,
	`english` varchar(255) NOT NULL,
	`meaning` varchar(500) NOT NULL DEFAULT '',
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vocab_words_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(16) NOT NULL DEFAULT 'user';