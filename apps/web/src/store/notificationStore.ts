import { create } from "zustand";

export type Notification = {
  id: string;
  type: "order_ready" | "order_placed" | "order_cancelled" | "low_stock" | "menu_change";
  title: string;
  message: string;
  url?: string;
  readAt?: Date;
  createdAt: Date;
};

type NotificationStore = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((state) => {
      const notification: Notification = {
        ...n,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      const next = [notification, ...state.notifications].slice(0, 10);
      return {
        notifications: next,
        unreadCount: state.unreadCount + 1,
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, readAt: new Date() })),
      unreadCount: 0,
    })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
