import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { ADMIN_PASSWORD, ADMIN_USERNAME, clearAdminCookie, isAdminRequest, setAdminCookie } from "./adminAuth";
import { createUnit, createWord, deleteUnit, deleteWord, getAds, getCatalog, getStats, recordVisit, updateAd, updateClass, updateUnit, updateWord } from "./content";
import { getSessionCookieOptions } from "./_core/cookies";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

const wordInput = z.object({ english: z.string().trim().min(1).max(255), meaning: z.string().trim().max(500).default("") });
const adInput = z.object({ slotKey: z.string().min(1), title: z.string().trim().min(1).max(120), type: z.enum(["placeholder", "adsense", "text", "video"]), content: z.string().max(20000), adsenseClient: z.string().max(120), adsenseSlot: z.string().max(120), videoUrl: z.string().max(500) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  content: router({
    catalog: publicProcedure.query(() => getCatalog()),
    ads: publicProcedure.query(() => getAds()),
  }),
  analytics: router({
    trackVisit: publicProcedure.mutation(async () => { await recordVisit(); return { success: true } as const; }),
  }),
  admin: router({
    me: publicProcedure.query(({ ctx }) => ({ authenticated: ctx.admin || ctx.user?.role === "admin", username: ctx.admin ? ADMIN_USERNAME : null })),
    login: publicProcedure.input(z.object({ username: z.string(), password: z.string() })).mutation(({ input, ctx }) => {
      if (input.username !== ADMIN_USERNAME || input.password !== ADMIN_PASSWORD) return { success: false as const, message: "Kullanıcı adı veya şifre hatalı." };
      setAdminCookie(ctx.res);
      return { success: true as const, message: "Admin girişi başarılı." };
    }),
    logout: publicProcedure.mutation(({ ctx }) => { clearAdminCookie(ctx.res); return { success: true } as const; }),
    dashboard: adminProcedure.query(async () => ({ stats: await getStats(), catalog: await getCatalog(), ads: await getAds() })),
    updateClass: adminProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(1).max(120) })).mutation(({ input }) => updateClass(input.id, input.name)),
    createUnit: adminProcedure.input(z.object({ grade: z.number().int().min(2).max(12), name: z.string().trim().min(1).max(180) })).mutation(({ input }) => createUnit(input.grade, input.name)),
    updateUnit: adminProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(1).max(180) })).mutation(({ input }) => updateUnit(input.id, input.name)),
    deleteUnit: adminProcedure.input(z.object({ id: z.number().int() })).mutation(({ input }) => deleteUnit(input.id)),
    createWord: adminProcedure.input(z.object({ unitId: z.number().int(), ...wordInput.shape })).mutation(({ input }) => createWord(input.unitId, input.english, input.meaning)),
    updateWord: adminProcedure.input(z.object({ id: z.number().int(), ...wordInput.shape })).mutation(({ input }) => updateWord(input.id, input.english, input.meaning)),
    deleteWord: adminProcedure.input(z.object({ id: z.number().int() })).mutation(({ input }) => deleteWord(input.id)),
    updateAd: adminProcedure.input(adInput).mutation(({ input }) => updateAd(input)),
  }),
});

export type AppRouter = typeof appRouter;
