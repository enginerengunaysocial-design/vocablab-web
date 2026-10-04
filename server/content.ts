import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { adSlots, vocabClasses, vocabUnits, vocabWords, visitStats } from "../drizzle/schema";
import { getDb } from "./db";

type SeedWord = { id: string; english: string; meaning: string };
type SeedUnit = { id: string; number: number; name: string; words: SeedWord[] };
type SeedGrade = { grade: number; units: SeedUnit[] };

export type CatalogWord = { id: number; english: string; meaning: string; position: number };
export type CatalogUnit = { id: number; unitNumber: number; name: string; words: CatalogWord[] };
export type CatalogGrade = { id: number; grade: number; name: string; units: CatalogUnit[]; wordCount: number };

export type AdConfig = {
  slotKey: string;
  title: string;
  type: string;
  content: string;
  adsenseClient: string;
  adsenseSlot: string;
  videoUrl: string;
};

export const DEFAULT_ADS = [
  { slotKey: "hero", title: "Üst reklam alanı" },
  { slotKey: "quiz", title: "Quiz arası reklam alanı" },
  { slotKey: "footer", title: "Alt reklam alanı" },
] as const;

function loadSeedData(): SeedGrade[] {
  const candidates = [
    path.join(process.cwd(), "seed-content.json"),
    path.join(process.cwd(), "..", "seed-content.json"),
  ];
  for (const filename of candidates) {
    if (fs.existsSync(filename)) return JSON.parse(fs.readFileSync(filename, "utf8")) as SeedGrade[];
  }
  return [];
}

export const seedData = loadSeedData();

export function fallbackCatalog(): CatalogGrade[] {
  return seedData.map((grade, gradeIndex) => ({
    id: gradeIndex + 1,
    grade: grade.grade,
    name: `${grade.grade}. Sınıf`,
    units: grade.units.map((unit, unitIndex) => ({
      id: unitIndex + 1,
      unitNumber: unit.number,
      name: unit.name,
      words: unit.words.map((word, wordIndex) => ({
        id: wordIndex + 1,
        english: word.english,
        meaning: word.meaning,
        position: wordIndex,
      })),
    })),
    wordCount: grade.units.reduce((sum, unit) => sum + unit.words.length, 0),
  }));
}

export async function ensureSeeded() {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: vocabClasses.id }).from(vocabClasses).limit(1);
  if (existing.length > 0) {
    await ensureAds(db);
    return true;
  }
  for (const grade of seedData) {
    await db.insert(vocabClasses).values({ grade: grade.grade, name: `${grade.grade}. Sınıf` });
    const classRow = (await db.select({ id: vocabClasses.id }).from(vocabClasses).where(eq(vocabClasses.grade, grade.grade)).limit(1))[0];
    if (!classRow) continue;
    for (const [unitIndex, unit] of grade.units.entries()) {
      await db.insert(vocabUnits).values({ classId: classRow.id, unitNumber: unitIndex + 1, name: unit.name });
      const unitRow = (await db.select({ id: vocabUnits.id }).from(vocabUnits).where(and(eq(vocabUnits.classId, classRow.id), eq(vocabUnits.unitNumber, unitIndex + 1))).limit(1))[0];
      if (!unitRow) continue;
      if (unit.words.length > 0) {
        await db.insert(vocabWords).values(unit.words.map((word, wordIndex) => ({
          unitId: unitRow.id,
          english: word.english,
          meaning: word.meaning,
          position: wordIndex,
        })));
      }
    }
  }
  await ensureAds(db);
  return true;
}

async function ensureAds(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  for (const ad of DEFAULT_ADS) {
    const found = await db.select({ id: adSlots.id }).from(adSlots).where(eq(adSlots.slotKey, ad.slotKey)).limit(1);
    if (!found.length) await db.insert(adSlots).values({ ...ad, type: "placeholder", content: "", adsenseClient: "", adsenseSlot: "", videoUrl: "" });
  }
}

export async function getCatalog(): Promise<CatalogGrade[]> {
  const db = await getDb();
  if (!db || !(await ensureSeeded())) return fallbackCatalog();
  const classes = await db.select().from(vocabClasses).orderBy(asc(vocabClasses.grade));
  const units = await db.select().from(vocabUnits).orderBy(asc(vocabUnits.classId), asc(vocabUnits.unitNumber));
  const words = await db.select().from(vocabWords).orderBy(asc(vocabWords.unitId), asc(vocabWords.position), asc(vocabWords.id));
  return classes.map(item => {
    const classUnits = units.filter(unit => unit.classId === item.id).map(unit => ({
      id: unit.id,
      unitNumber: unit.unitNumber,
      name: unit.name,
      words: words.filter(word => word.unitId === unit.id).map(word => ({ id: word.id, english: word.english, meaning: word.meaning, position: word.position })),
    }));
    return { id: item.id, grade: item.grade, name: item.name, units: classUnits, wordCount: classUnits.reduce((sum, unit) => sum + unit.words.length, 0) };
  });
}

export async function getAds(): Promise<AdConfig[]> {
  const db = await getDb();
  if (!db || !(await ensureSeeded())) return DEFAULT_ADS.map(ad => ({ ...ad, type: "placeholder", content: "", adsenseClient: "", adsenseSlot: "", videoUrl: "" }));
  return db.select({ slotKey: adSlots.slotKey, title: adSlots.title, type: adSlots.type, content: adSlots.content, adsenseClient: adSlots.adsenseClient, adsenseSlot: adSlots.adsenseSlot, videoUrl: adSlots.videoUrl }).from(adSlots).orderBy(asc(adSlots.id));
}

export async function getStats() {
  const db = await getDb();
  if (!db) return { today: 0, month: 0 };
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const monthKey = dayKey.slice(0, 7);
  const todayRow = (await db.select({ count: visitStats.count }).from(visitStats).where(eq(visitStats.dayKey, dayKey)).limit(1))[0];
  const monthRows = await db.select({ count: visitStats.count }).from(visitStats).where(like(visitStats.dayKey, `${monthKey}%`));
  return { today: todayRow?.count ?? 0, month: monthRows.reduce((sum, row) => sum + row.count, 0) };
}

export async function recordVisit() {
  const db = await getDb();
  if (!db) return;
  const dayKey = new Date().toISOString().slice(0, 10);
  await db.insert(visitStats).values({ dayKey, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${visitStats.count} + 1` } });
}

export async function createUnit(grade: number, name: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await ensureSeeded();
  let classRow = (await db.select().from(vocabClasses).where(eq(vocabClasses.grade, grade)).limit(1))[0];
  if (!classRow) {
    await db.insert(vocabClasses).values({ grade, name: `${grade}. Sınıf` });
    classRow = (await db.select().from(vocabClasses).where(eq(vocabClasses.grade, grade)).limit(1))[0];
  }
  if (!classRow) throw new Error("Class could not be created");
  const last = (await db.select({ unitNumber: vocabUnits.unitNumber }).from(vocabUnits).where(eq(vocabUnits.classId, classRow.id)).orderBy(desc(vocabUnits.unitNumber)).limit(1))[0];
  await db.insert(vocabUnits).values({ classId: classRow.id, unitNumber: (last?.unitNumber ?? 0) + 1, name });
}

export async function updateUnit(id: number, name: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(vocabUnits).set({ name }).where(eq(vocabUnits.id, id));
}

export async function deleteUnit(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.delete(vocabWords).where(eq(vocabWords.unitId, id));
  await db.delete(vocabUnits).where(eq(vocabUnits.id, id));
}

export async function createWord(unitId: number, english: string, meaning: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const last = (await db.select({ position: vocabWords.position }).from(vocabWords).where(eq(vocabWords.unitId, unitId)).orderBy(desc(vocabWords.position)).limit(1))[0];
  await db.insert(vocabWords).values({ unitId, english, meaning, position: (last?.position ?? -1) + 1 });
}

export async function updateWord(id: number, english: string, meaning: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(vocabWords).set({ english, meaning }).where(eq(vocabWords.id, id));
}

export async function deleteWord(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.delete(vocabWords).where(eq(vocabWords.id, id));
}

export async function updateClass(id: number, name: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(vocabClasses).set({ name }).where(eq(vocabClasses.id, id));
}

export async function updateAd(input: AdConfig) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await ensureAds(db);
  await db.update(adSlots).set({ title: input.title, type: input.type, content: input.content, adsenseClient: input.adsenseClient, adsenseSlot: input.adsenseSlot, videoUrl: input.videoUrl }).where(eq(adSlots.slotKey, input.slotKey));
}
