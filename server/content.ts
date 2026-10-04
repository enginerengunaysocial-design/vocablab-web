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

type FallbackState = {
  catalog: CatalogGrade[];
  ads: AdConfig[];
  stats: { today: number; month: number; dayKey: string; monthKey: string };
};

const fallbackStorePath = process.env.CONTENT_STORE_PATH || path.join(process.cwd(), "content-store.json");
let fallbackState: FallbackState | null = null;

function defaultFallbackState(): FallbackState {
  return {
    catalog: fallbackCatalog(),
    ads: DEFAULT_ADS.map(ad => ({ ...ad, type: "placeholder", content: "", adsenseClient: "", adsenseSlot: "", videoUrl: "" })),
    stats: { today: 0, month: 0, dayKey: new Date().toISOString().slice(0, 10), monthKey: new Date().toISOString().slice(0, 7) },
  };
}

function getFallbackState() {
  if (fallbackState) return fallbackState;
  try {
    if (fs.existsSync(fallbackStorePath)) {
      fallbackState = JSON.parse(fs.readFileSync(fallbackStorePath, "utf8")) as FallbackState;
    }
  } catch (error) {
    console.warn("[Content] Fallback store could not be read; using seed data:", error);
  }
  fallbackState ??= defaultFallbackState();
  return fallbackState;
}

function saveFallbackState() {
  if (!fallbackState) return;
  try {
    fs.writeFileSync(fallbackStorePath, JSON.stringify(fallbackState, null, 2), "utf8");
  } catch (error) {
    console.warn("[Content] Fallback store could not be saved:", error);
  }
}

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
  if (!db || !(await ensureSeeded())) return getFallbackState().catalog;
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
  if (!db || !(await ensureSeeded())) return getFallbackState().ads;
  return db.select({ slotKey: adSlots.slotKey, title: adSlots.title, type: adSlots.type, content: adSlots.content, adsenseClient: adSlots.adsenseClient, adsenseSlot: adSlots.adsenseSlot, videoUrl: adSlots.videoUrl }).from(adSlots).orderBy(asc(adSlots.id));
}

export async function getStats() {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    if (state.stats.dayKey !== today) { state.stats.dayKey = today; state.stats.today = 0; }
    if (state.stats.monthKey !== month) { state.stats.monthKey = month; state.stats.month = 0; }
    saveFallbackState();
    return { today: state.stats.today, month: state.stats.month };
  }
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const monthKey = dayKey.slice(0, 7);
  const todayRow = (await db.select({ count: visitStats.count }).from(visitStats).where(eq(visitStats.dayKey, dayKey)).limit(1))[0];
  const monthRows = await db.select({ count: visitStats.count }).from(visitStats).where(like(visitStats.dayKey, `${monthKey}%`));
  return { today: todayRow?.count ?? 0, month: monthRows.reduce((sum, row) => sum + row.count, 0) };
}

export async function recordVisit() {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    if (state.stats.dayKey !== today) { state.stats.dayKey = today; state.stats.today = 0; }
    if (state.stats.monthKey !== month) { state.stats.monthKey = month; state.stats.month = 0; }
    state.stats.today += 1;
    state.stats.month += 1;
    saveFallbackState();
    return;
  }
  const dayKey = new Date().toISOString().slice(0, 10);
  await db.insert(visitStats).values({ dayKey, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${visitStats.count} + 1` } });
}

export async function createUnit(grade: number, name: string) {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    let classRow = state.catalog.find(item => item.grade === grade);
    if (!classRow) {
      classRow = { id: Math.max(0, ...state.catalog.map(item => item.id)) + 1, grade, name: `${grade}. Sınıf`, units: [], wordCount: 0 };
      state.catalog.push(classRow);
    }
    const unitId = Math.max(0, ...state.catalog.flatMap(item => item.units.map(unit => unit.id))) + 1;
    classRow.units.push({ id: unitId, unitNumber: classRow.units.length + 1, name, words: [] });
    saveFallbackState();
    return;
  }
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
  const db = await getDb();
  if (!db) {
    const unit = getFallbackState().catalog.flatMap(item => item.units).find(item => item.id === id);
    if (!unit) throw new Error("Unit not found");
    unit.name = name;
    saveFallbackState();
    return;
  }
  await db.update(vocabUnits).set({ name }).where(eq(vocabUnits.id, id));
}

export async function deleteUnit(id: number) {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    for (const grade of state.catalog) {
      const index = grade.units.findIndex(unit => unit.id === id);
      if (index >= 0) { grade.units.splice(index, 1); grade.units.forEach((unit, unitIndex) => { unit.unitNumber = unitIndex + 1; }); grade.wordCount = grade.units.reduce((sum, unit) => sum + unit.words.length, 0); saveFallbackState(); return; }
    }
    throw new Error("Unit not found");
  }
  await db.delete(vocabWords).where(eq(vocabWords.unitId, id));
  await db.delete(vocabUnits).where(eq(vocabUnits.id, id));
}

export async function createWord(unitId: number, english: string, meaning: string) {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    const unit = state.catalog.flatMap(item => item.units).find(item => item.id === unitId);
    if (!unit) throw new Error("Unit not found");
    const wordId = Math.max(0, ...state.catalog.flatMap(item => item.units.flatMap(entry => entry.words.map(word => word.id)))) + 1;
    unit.words.push({ id: wordId, english, meaning, position: unit.words.length });
    const grade = state.catalog.find(item => item.units.some(entry => entry.id === unitId));
    if (grade) grade.wordCount = grade.units.reduce((sum, entry) => sum + entry.words.length, 0);
    saveFallbackState();
    return;
  }
  const last = (await db.select({ position: vocabWords.position }).from(vocabWords).where(eq(vocabWords.unitId, unitId)).orderBy(desc(vocabWords.position)).limit(1))[0];
  await db.insert(vocabWords).values({ unitId, english, meaning, position: (last?.position ?? -1) + 1 });
}

export async function updateWord(id: number, english: string, meaning: string) {
  const db = await getDb();
  if (!db) {
    const word = getFallbackState().catalog.flatMap(item => item.units.flatMap(unit => unit.words)).find(item => item.id === id);
    if (!word) throw new Error("Word not found");
    word.english = english;
    word.meaning = meaning;
    saveFallbackState();
    return;
  }
  await db.update(vocabWords).set({ english, meaning }).where(eq(vocabWords.id, id));
}

export async function deleteWord(id: number) {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    for (const grade of state.catalog) for (const unit of grade.units) {
      const index = unit.words.findIndex(word => word.id === id);
      if (index >= 0) { unit.words.splice(index, 1); unit.words.forEach((word, wordIndex) => { word.position = wordIndex; }); grade.wordCount = grade.units.reduce((sum, entry) => sum + entry.words.length, 0); saveFallbackState(); return; }
    }
    throw new Error("Word not found");
  }
  await db.delete(vocabWords).where(eq(vocabWords.id, id));
}

export async function updateClass(id: number, name: string) {
  const db = await getDb();
  if (!db) {
    const item = getFallbackState().catalog.find(entry => entry.id === id);
    if (!item) throw new Error("Class not found");
    item.name = name;
    saveFallbackState();
    return;
  }
  await db.update(vocabClasses).set({ name }).where(eq(vocabClasses.id, id));
}

export async function updateAd(input: AdConfig) {
  const db = await getDb();
  if (!db) {
    const state = getFallbackState();
    const index = state.ads.findIndex(ad => ad.slotKey === input.slotKey);
    if (index < 0) throw new Error("Ad slot not found");
    state.ads[index] = input;
    saveFallbackState();
    return;
  }
  await ensureAds(db);
  await db.update(adSlots).set({ title: input.title, type: input.type, content: input.content, adsenseClient: input.adsenseClient, adsenseSlot: input.adsenseSlot, videoUrl: input.videoUrl }).where(eq(adSlots.slotKey, input.slotKey));
}
