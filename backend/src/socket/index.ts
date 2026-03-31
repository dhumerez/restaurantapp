import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "../middleware/auth.js";

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as JwtPayload;

    // Superadmins don't join restaurant rooms
    if (user.scope === "platform") {
      socket.join("platform:admins");
      return;
    }

    const restaurantRoom = `restaurant:${user.restaurantId}`;

    // Join restaurant room
    socket.join(restaurantRoom);

    // Join role-specific room
    if (user.role === "kitchen") {
      socket.join(`kitchen:${user.restaurantId}`);
    } else if (user.role === "waiter") {
      socket.join(`waiter:${user.restaurantId}`);
    } else if (user.role === "admin") {
      // Admin joins all rooms
      socket.join(`kitchen:${user.restaurantId}`);
      socket.join(`waiter:${user.restaurantId}`);
    }

    socket.on("disconnect", () => {
      // Cleanup handled automatically by Socket.IO
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
