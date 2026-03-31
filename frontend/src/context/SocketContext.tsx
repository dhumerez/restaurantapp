import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "";
const SOCKET_PATH = API_URL ? "/socket.io/" : (import.meta.env.BASE_URL + "socket.io/");

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user || user.role === "superadmin") {
      setSocket(null);
      return;
    }

    const newSocket = io(API_URL || window.location.origin, {
      auth: (cb) => {
        cb({ token: localStorage.getItem("accessToken") });
      },
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
