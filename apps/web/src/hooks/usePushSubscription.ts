import { useEffect } from "react";
import { trpc } from "../trpc.js";
import { authClient } from "../auth.js";

export function usePushSubscription() {
  const { data: session } = authClient.useSession();
  const { data: vapidData } = trpc.push.vapidPublicKey.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const subscribe = trpc.push.subscribe.useMutation();

  useEffect(() => {
    if (!vapidData?.key || !session?.user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const role = (session.user as any).role;
    if (!["waiter", "kitchen", "admin"].includes(role)) return;

    async function requestSubscription() {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        const json = existing.toJSON();
        subscribe.mutate({
          endpoint: json.endpoint!,
          p256dh: (json.keys as any).p256dh,
          auth: (json.keys as any).auth,
          userAgent: navigator.userAgent,
        });
        return;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData!.key!),
      });

      const json = sub.toJSON();
      subscribe.mutate({
        endpoint: json.endpoint!,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
        userAgent: navigator.userAgent,
      });
    }

    requestSubscription();
  }, [vapidData?.key, session?.user?.id]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
