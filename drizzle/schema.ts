import { int, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vocabClasses = mysqlTable("vocab_classes", {
  id: int("id").autoincrement().primaryKey(),
  grade: int("grade").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  gradeUnique: uniqueIndex("vocab_classes_grade_unique").on(table.grade),
}));

export const vocabUnits = mysqlTable("vocab_units", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  unitNumber: int("unitNumber").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  classUnitUnique: uniqueIndex("vocab_units_class_unit_unique").on(table.classId, table.unitNumber),
}));

export const vocabWords = mysqlTable("vocab_words", {
  id: int("id").autoincrement().primaryKey(),
  unitId: int("unitId").notNull(),
  english: varchar("english", { length: 255 }).notNull(),
  meaning: varchar("meaning", { length: 500 }).default("").notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adSlots = mysqlTable("ad_slots", {
  id: int("id").autoincrement().primaryKey(),
  slotKey: varchar("slotKey", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  type: varchar("type", { length: 24 }).default("placeholder").notNull(),
  content: text("content").notNull(),
  adsenseClient: varchar("adsenseClient", { length: 120 }).default("").notNull(),
  adsenseSlot: varchar("adsenseSlot", { length: 120 }).default("").notNull(),
  videoUrl: varchar("videoUrl", { length: 500 }).default("").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const visitStats = mysqlTable("visit_stats", {
  id: int("id").autoincrement().primaryKey(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  count: int("count").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  dayUnique: uniqueIndex("visit_stats_day_unique").on(table.dayKey),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
