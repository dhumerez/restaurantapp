import { createTRPCClient, httpBatchLink, splitLink, wsLink, createWSClient } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../server/src/router/index.js";

export const trpc = createTRPCReact<AppRouter>();

const apiBase = import.meta.env.VITE_API_URL ?? "";

// `new WebSocket(url)` requires an absolute ws:// or wss:// URL; relative
// paths throw SyntaxError. When apiBase is empty (dev: HTTP goes through the
// Vite proxy), derive the WS origin from the current page so the proxy still
// forwards the upgrade.
function buildWsUrl(): string {
  if (apiBase) return `${apiBase.replace(/^http/, "ws")}/api/trpc`;
  if (typeof window === "undefined") return "ws://localhost/api/trpc";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/trpc`;
}

const wsClient = createWSClient({
  url: buildWsUrl(),
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
