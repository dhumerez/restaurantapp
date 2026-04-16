import { create } from "zustand";

type SessionData = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    restaurantId: string;
    [key: string]: any;
  };
  session: any;
} | null;

type SessionStore = {
  session: SessionData;
  setSession: (s: SessionData) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
