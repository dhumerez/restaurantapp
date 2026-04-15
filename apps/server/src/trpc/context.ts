import type { FastifyRequest, FastifyReply } from "fastify";
import { auth, type User } from "../lib/auth.js";
import { db } from "../lib/db.js";

export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}) {
  const session = await auth.api.getSession({
    headers: req.headers as unknown as Headers,
  });

  return {
    db,
    req,
    res,
    session: session?.session ?? null,
    user: (session?.user ?? null) as User | null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
