/**
 * Single import point for the data model.
 *
 *   import type { JobFeedItem, ApplicationStatus } from '@/lib/types';
 *
 * The model is split across three files (enums, models, database) but every
 * consumer goes through here, so moving things around later is cheap.
 */
export * from "./enums";
export * from "./models";
export * from "./format";
export type { Database, Tables, InsertTable, UpdateTable } from "./database";
