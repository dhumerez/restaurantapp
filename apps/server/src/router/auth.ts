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

        // 1. Create anonymous session. Pass empty headers so Better Auth's
        //    anonymous plugin doesn't see an existing anonymous session and
        //    throw ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY — this
        //    lets a user switch demo roles repeatedly from /demo.
        const { headers: signInHeaders, response: signInResponse } =
          await auth.api.signInAnonymous({
            headers: new Headers(),
            returnHeaders: true,
          });

        if (!signInResponse?.user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        // 2. Assign demo role + restaurant directly in the DB.
        await db
          .update(user)
          .set({
            role: input.role,
            restaurantId: demoRestaurant.id,
            isActive: true,
            emailVerified: true,
            name: `Demo ${input.role.charAt(0).toUpperCase() + input.role.slice(1)}`,
          })
          .where(eq(user.id, signInResponse.user.id));

        // 3. Better Auth caches the user inside the `session_data` cookie at
        //    sign-in time (cookieCache). That snapshot still has role=null,
        //    so the next getSession() on the client would see a role-less
        //    user and bounce to /pending. Re-run getSession with the new
        //    session token and disableCookieCache so Better Auth re-reads
        //    the user from the DB and emits a fresh session_data cookie.
        const cookieHeader = signInHeaders
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ");

        const { headers: refreshHeaders } = await auth.api.getSession({
          headers: new Headers({ cookie: cookieHeader }),
          query: { disableCookieCache: true },
          returnHeaders: true,
        });

        // 4. Merge cookies from both calls. signInHeaders carries the
        //    session_token (the source of truth); refreshHeaders carries the
        //    fresh session_data cache (with the new role). For each cookie
        //    name, the refreshed version wins.
        const merged = new Map<string, string>();
        for (const c of signInHeaders.getSetCookie()) {
          merged.set(c.split("=")[0], c);
        }
        for (const c of refreshHeaders.getSetCookie()) {
          merged.set(c.split("=")[0], c);
        }
        const setCookies = [...merged.values()];
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
