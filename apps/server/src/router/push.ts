import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc/trpc.js";
import { pushSubscriptions } from "@restaurant/db";
import webpush from "web-push";
import { env } from "../config/env.js";

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:admin@localhost",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushNotification(
  db: any,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!env.VAPID_PUBLIC_KEY) return; // push disabled

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const notifications = subs.map((sub: any) =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    ).catch(() => {
      // If endpoint is gone, delete subscription
      db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    })
  );

  await Promise.allSettled(notifications);
}

export const pushRouter = router({
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint));

      if (existing.length === 0) {
        await ctx.db.insert(pushSubscriptions).values({
          userId: ctx.user!.id,
          ...input,
        });
      }
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint));
      return { success: true };
    }),

  vapidPublicKey: protectedProcedure.query(() => {
    return { key: env.VAPID_PUBLIC_KEY ?? null };
  }),
});
