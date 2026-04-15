import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc.js";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { restaurants, user } from "@restaurant/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const authRouter = router({
  demo: router({
    create: publicProcedure
      .input(z.object({
        role: z.enum(["admin", "waiter", "kitchen", "cashier"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Find the demo restaurant
        const [demoRestaurant] = await db
          .select()
          .from(restaurants)
          .where(eq(restaurants.status, "demo"));

        if (!demoRestaurant) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Demo not configured" });
        }

        // Create anonymous session via Better Auth anonymous plugin.
        // returnHeaders is required so we can forward Set-Cookie to the browser.
        const { headers: authHeaders, response } = await auth.api.signInAnonymous({
          headers: ctx.req.headers as any,
          returnHeaders: true,
        });

        if (!response?.user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        // Assign demo role + restaurant
        await db
          .update(user)
          .set({
            role: input.role,
            restaurantId: demoRestaurant.id,
            isActive: true,
            emailVerified: true,
            name: `Demo ${input.role.charAt(0).toUpperCase() + input.role.slice(1)}`,
          })
          .where(eq(user.id, response.user.id));

        // Forward Set-Cookie headers from Better Auth to the Fastify reply.
        // getSetCookie() preserves multiple cookies instead of collapsing them.
        const setCookies = authHeaders.getSetCookie();
        if (setCookies.length > 0) {
          ctx.res.header("set-cookie", setCookies);
        }

        return {
          role: input.role,
          restaurantId: demoRestaurant.id,
          redirect: input.role === "admin" ? "/admin"
            : input.role === "waiter" ? "/waiter/tables"
            : input.role === "kitchen" ? "/kitchen"
            : "/cashier/tables",
        };
      }),
  }),
});
