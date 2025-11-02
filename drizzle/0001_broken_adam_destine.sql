CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`speaker` enum('user','guest') NOT NULL,
	`originalText` text NOT NULL,
	`translatedText` text NOT NULL,
	`language` varchar(16) NOT NULL,
	`confidence` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`language1` varchar(16) NOT NULL,
	`language2` varchar(16) NOT NULL,
	`status` enum('active','completed','failed') NOT NULL DEFAULT 'active',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `languages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`baseCode` varchar(8) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nativeName` varchar(255),
	`direction` enum('ltr','rtl') NOT NULL DEFAULT 'ltr',
	`countryCode` varchar(8),
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `languages_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `stt_languages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`lang` varchar(8) NOT NULL,
	`origin` varchar(255),
	`displayLang` varchar(255),
	`displayOrigin` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stt_languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `stt_languages_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tts_voices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`language` varchar(16) NOT NULL,
	`voice` varchar(255) NOT NULL,
	`gender` enum('male','female','neutral') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tts_voices_id` PRIMARY KEY(`id`),
	CONSTRAINT `tts_voices_voice_unique` UNIQUE(`voice`)
);
--> statement-breakpoint
CREATE TABLE `ttt_languages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nativeName` varchar(255),
	`direction` enum('ltr','rtl') NOT NULL DEFAULT 'ltr',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ttt_languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `ttt_languages_code_unique` UNIQUE(`code`)
);
