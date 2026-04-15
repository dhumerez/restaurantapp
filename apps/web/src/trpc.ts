import { createTRPCClient, httpBatchLink, splitLink, wsLink, createWSClient } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../server/src/router/index.js";

export const trpc = createTRPCReact<AppRouter>();

const apiBase = import.meta.env.VITE_API_URL ?? "";

const wsClient = createWSClient({
  url: `${apiBase.replace("http", "ws")}/api/trpc`,
});

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: `${apiBase}/api/trpc`,
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    }),
  ],
});
