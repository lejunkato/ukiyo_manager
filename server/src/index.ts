import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Prisma, type OrderStatus } from "@prisma/client";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { hashPassword, requireAuth, requireSuperAdmin, signToken, verifyPassword, verifyToken } from "./auth.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { categoryDto, menuItemDto, orderDto, roomDto, roomSessionDto, tabDto, userDto } from "./serializers.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/admin" });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../../dist");

function createPublicRoomCode() {
  return `rm_${randomUUID().replace(/-/g, "")}`;
}

type AdminEventType =
  | "orders:changed"
  | "sessions:changed"
  | "menu:changed"
  | "rooms:changed";

interface AdminEvent {
  type: AdminEventType;
  reason: string;
  at: string;
}

const adminSockets = new Set<WebSocket>();

function broadcastAdminEvent(type: AdminEventType, reason: string) {
  const message = JSON.stringify({
    type,
    reason,
    at: new Date().toISOString()
  } satisfies AdminEvent);

  for (const socket of adminSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    socket.close(1008, "missing_token");
    return;
  }

  try {
    verifyToken(token);
  } catch {
    socket.close(1008, "invalid_token");
    return;
  }

  adminSockets.add(socket);
  socket.send(JSON.stringify({
    type: "orders:changed",
    reason: "connected",
    at: new Date().toISOString()
  } satisfies AdminEvent));

  socket.on("close", () => {
    adminSockets.delete(socket);
  });
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

interface CreateOrderItemInput {
  menuItemId?: string;
  name: string;
  quantity: number;
  price: number | string;
  observations?: string;
}

interface DbUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "superadmin";
  active: boolean;
  passwordHash: string | null;
  picture: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function resolveRoom(identifier: string) {
  const direct = await prisma.room.findUnique({ where: { id: identifier } });
  if (direct) return direct;

  const byPublicCode = await prisma.room.findFirst({ where: { publicCode: identifier } as any });
  if (byPublicCode) return byPublicCode;

  return null;
}

async function getActiveRoomSession(roomId: string) {
  return prisma.roomSession.findFirst({
    where: {
      roomId,
      active: true
    },
    orderBy: {
      startedAt: "desc"
    }
  });
}

async function maybeCloseRoomSessionIfSettled(roomSessionId: string | null) {
  if (!roomSessionId) return;

  const tabs = await prisma.tab.findMany({
    where: { roomSessionId },
    select: { id: true, paid: true }
  });

  if (tabs.length === 0 || tabs.some((tab) => !tab.paid)) return;

  const now = new Date();
  await prisma.roomSession.update({
    where: { id: roomSessionId },
    data: {
      active: false,
      closedAt: now,
      tabs: {
        updateMany: {
          where: {},
          data: {
            active: false,
            closedAt: now
          }
        }
      }
    }
  });

  broadcastAdminEvent("sessions:changed", "room_session_closed");
}

async function findUserByEmail(email: string) {
  const users = await prisma.$queryRaw<DbUser[]>`
    SELECT
      "id",
      "email",
      "name",
      "role"::text AS "role",
      "active",
      "passwordHash",
      "picture",
      "createdAt",
      "updatedAt"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;

  return users[0] ?? null;
}

async function upsertEnvSuperAdmin(email: string, password: string) {
  const users = await prisma.$queryRaw<DbUser[]>`
    INSERT INTO "User" (
      "id",
      "email",
      "name",
      "role",
      "active",
      "passwordHash",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${`user_${randomUUID()}`},
      ${email},
      ${email},
      'superadmin'::"UserRole",
      true,
      ${hashPassword(password)},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("email") DO UPDATE
    SET
      "name" = EXCLUDED."name",
      "role" = 'superadmin'::"UserRole",
      "active" = true,
      "passwordHash" = EXCLUDED."passwordHash",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "id",
      "email",
      "name",
      "role"::text AS "role",
      "active",
      "passwordHash",
      "picture",
      "createdAt",
      "updatedAt"
  `;

  return users[0];
}

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    let user = await findUserByEmail(email);

    if (email === env.adminEmail && password === env.adminPassword) {
      user = await upsertEnvSuperAdmin(email, password);
    } else if (!user?.active || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      picture: user.picture
    };
    const token = signToken(authUser);
    res.json({
      token,
      user: authUser
    });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/auth/users", requireSuperAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.$queryRaw<DbUser[]>`
      SELECT
        "id",
        "email",
        "name",
        "role"::text AS "role",
        "active",
        "passwordHash",
        "picture",
        "createdAt",
        "updatedAt"
      FROM "User"
      ORDER BY "role"::text DESC, "name" ASC
    `;

    res.json(users.map(userDto));
  } catch (error) {
    next(error);
  }
});

app.post("/auth/users", requireSuperAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const name = String(req.body.name ?? "").trim();
    const password = String(req.body.password ?? "");
    const role = req.body.role === "superadmin" ? "superadmin" : "admin";

    if (!email || !name || password.length < 6) {
      res.status(400).json({ error: "invalid_user_data" });
      return;
    }

    const users = await prisma.$queryRaw<DbUser[]>`
      INSERT INTO "User" (
        "id",
        "email",
        "name",
        "role",
        "active",
        "passwordHash",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${`user_${randomUUID()}`},
        ${email},
        ${name},
        ${role}::"UserRole",
        ${Boolean(req.body.active ?? true)},
        ${hashPassword(password)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "email",
        "name",
        "role"::text AS "role",
        "active",
        "passwordHash",
        "picture",
        "createdAt",
        "updatedAt"
    `;

    res.status(201).json(userDto(users[0]));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "user_already_exists" });
      return;
    }

    next(error);
  }
});

app.patch("/auth/users/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const userId = routeParam(req.params.id);
    if (req.user?.id === userId && req.body.active === false) {
      res.status(400).json({ error: "cannot_disable_self" });
      return;
    }

    const nextPassword = req.body.password === undefined
      ? undefined
      : String(req.body.password);

    if (nextPassword !== undefined && nextPassword.length < 6) {
      res.status(400).json({ error: "invalid_password" });
      return;
    }

    const existingUsers = await prisma.$queryRaw<DbUser[]>`
      SELECT
        "id",
        "email",
        "name",
        "role"::text AS "role",
        "active",
        "passwordHash",
        "picture",
        "createdAt",
        "updatedAt"
      FROM "User"
      WHERE "id" = ${userId}
      LIMIT 1
    `;
    const existingUser = existingUsers[0];
    if (!existingUser) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const nextEmail = req.body.email === undefined
      ? existingUser.email
      : String(req.body.email).trim().toLowerCase();
    const nextName = req.body.name === undefined
      ? existingUser.name
      : String(req.body.name).trim();
    const nextRole = req.body.role === undefined
      ? existingUser.role
      : req.body.role === "superadmin" ? "superadmin" : "admin";
    const nextActive = req.body.active === undefined
      ? existingUser.active
      : Boolean(req.body.active);
    const nextPasswordHash = nextPassword === undefined
      ? existingUser.passwordHash
      : hashPassword(nextPassword);

    const users = await prisma.$queryRaw<DbUser[]>`
      UPDATE "User"
      SET
        "email" = ${nextEmail},
        "name" = ${nextName},
        "role" = ${nextRole}::"UserRole",
        "active" = ${nextActive},
        "passwordHash" = ${nextPasswordHash},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${userId}
      RETURNING
        "id",
        "email",
        "name",
        "role"::text AS "role",
        "active",
        "passwordHash",
        "picture",
        "createdAt",
        "updatedAt"
    `;

    res.json(userDto(users[0]));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "user_already_exists" });
      return;
    }

    next(error);
  }
});

app.get("/rooms", async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({ orderBy: [{ floor: "asc" }, { name: "asc" }] });
    res.json(rooms.map(roomDto));
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    res.json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId/active-session", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const activeSession = await getActiveRoomSession(room.id);
    res.json({
      room: roomDto(room),
      activeSession: activeSession ? roomSessionDto(activeSession) : null
    });
  } catch (error) {
    next(error);
  }
});

app.post("/rooms/:roomId/sessions", requireAuth, async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const existingSession = await getActiveRoomSession(room.id);
    if (existingSession) {
      res.status(409).json({ error: "room_session_already_open" });
      return;
    }

    const requestedStartedAt = req.body.startedAt === undefined
      ? new Date()
      : new Date(String(req.body.startedAt));

    if (Number.isNaN(requestedStartedAt.getTime())) {
      res.status(400).json({ error: "invalid_started_at" });
      return;
    }

    const session = await prisma.roomSession.create({
      data: {
        roomId: room.id,
        startedAt: requestedStartedAt
      }
    });

    broadcastAdminEvent("sessions:changed", "room_session_created");
    res.status(201).json(roomSessionDto(session));
  } catch (error) {
    next(error);
  }
});

app.patch("/room-sessions/:id/close", requireAuth, async (req, res, next) => {
  try {
    const sessionId = routeParam(req.params.id);
    const session = await prisma.roomSession.update({
      where: { id: sessionId },
      data: {
        active: false,
        closedAt: new Date(),
        tabs: {
          updateMany: {
            where: {
              paid: true
            },
            data: {
              active: false,
              closedAt: new Date()
            }
          }
        }
      }
    });

    broadcastAdminEvent("sessions:changed", "room_session_closed");
    res.json(roomSessionDto(session));
  } catch (error) {
    next(error);
  }
});

app.post("/rooms", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.room.create({
      data: {
        publicCode: createPublicRoomCode(),
        name: String(req.body.name),
        floor: Number(req.body.floor),
        capacity: Number(req.body.capacity),
        hourlyRate: new Prisma.Decimal(req.body.hourlyRate),
        active: Boolean(req.body.active ?? true)
      } as any
    });
    broadcastAdminEvent("rooms:changed", "room_created");
    res.status(201).json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.put("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.room.update({
      where: { id: routeParam(req.params.id) },
      data: {
        name: req.body.name,
        floor: req.body.floor === undefined ? undefined : Number(req.body.floor),
        capacity: req.body.capacity === undefined ? undefined : Number(req.body.capacity),
        hourlyRate: req.body.hourlyRate === undefined ? undefined : new Prisma.Decimal(req.body.hourlyRate),
        active: req.body.active
      }
    });
    broadcastAdminEvent("rooms:changed", "room_updated");
    res.json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.delete("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: routeParam(req.params.id) } });
    broadcastAdminEvent("rooms:changed", "room_deleted");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
    res.json(categories.map(categoryDto));
  } catch (error) {
    next(error);
  }
});

app.post("/categories", requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.category.count();
    const category = await prisma.category.create({
      data: {
        name: String(req.body.name),
        description: String(req.body.description ?? ""),
        order: Number(req.body.order ?? count + 1)
      }
    });
    broadcastAdminEvent("menu:changed", "category_created");
    res.status(201).json(categoryDto(category));
  } catch (error) {
    next(error);
  }
});

app.put("/categories/:id", requireAuth, async (req, res, next) => {
  try {
    const category = await prisma.category.update({
      where: { id: routeParam(req.params.id) },
      data: {
        name: req.body.name,
        description: req.body.description,
        order: req.body.order === undefined ? undefined : Number(req.body.order)
      }
    });
    broadcastAdminEvent("menu:changed", "category_updated");
    res.json(categoryDto(category));
  } catch (error) {
    next(error);
  }
});

app.delete("/categories/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: routeParam(req.params.id) } });
    broadcastAdminEvent("menu:changed", "category_deleted");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/menu-items", async (_req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: { category: true },
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }]
    });
    res.json(items.map(menuItemDto));
  } catch (error) {
    next(error);
  }
});

app.post("/menu-items", requireAuth, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.create({
      data: {
        categoryId: String(req.body.categoryId),
        name: String(req.body.name),
        description: String(req.body.description ?? ""),
        price: new Prisma.Decimal(req.body.price),
        available: Boolean(req.body.available ?? true),
        image: req.body.image
      },
      include: { category: true }
    });
    broadcastAdminEvent("menu:changed", "menu_item_created");
    res.status(201).json(menuItemDto(item));
  } catch (error) {
    next(error);
  }
});

app.put("/menu-items/:id", requireAuth, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.update({
      where: { id: routeParam(req.params.id) },
      data: {
        categoryId: req.body.categoryId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price === undefined ? undefined : new Prisma.Decimal(req.body.price),
        available: req.body.available,
        image: req.body.image
      },
      include: { category: true }
    });
    broadcastAdminEvent("menu:changed", "menu_item_updated");
    res.json(menuItemDto(item));
  } catch (error) {
    next(error);
  }
});

app.delete("/menu-items/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.menuItem.delete({ where: { id: routeParam(req.params.id) } });
    broadcastAdminEvent("menu:changed", "menu_item_deleted");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId/tabs", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const activeSession = await getActiveRoomSession(room.id);
    if (!activeSession) {
      res.status(409).json({ error: "room_session_not_open" });
      return;
    }

    const tabs = await prisma.tab.findMany({
      where: { roomId: room.id, roomSessionId: activeSession.id, active: true },
      orderBy: { createdAt: "asc" }
    });
    res.json(tabs.map(tabDto));
  } catch (error) {
    next(error);
  }
});

app.post("/rooms/:roomId/tabs", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const activeSession = await getActiveRoomSession(room.id);
    if (!activeSession) {
      res.status(409).json({ error: "room_session_not_open" });
      return;
    }

    const tab = await prisma.tab.create({
      data: {
        roomId: room.id,
        roomSessionId: activeSession.id,
        tabName: String(req.body.tabName),
        personName: String(req.body.personName)
      }
    });
    broadcastAdminEvent("sessions:changed", "tab_created");
    res.status(201).json(tabDto(tab));
  } catch (error) {
    next(error);
  }
});

app.patch("/tabs/:id", requireAuth, async (req, res, next) => {
  try {
    const tabId = routeParam(req.params.id);
    const shouldMarkAsPaid = req.body.paid === true;

    if (shouldMarkAsPaid) {
      const result = await prisma.tab.updateMany({
        where: {
          id: tabId,
          paid: false
        },
        data: {
          paid: true,
          active: req.body.active,
          roomChargePaid: req.body.roomChargePaid === undefined
            ? undefined
            : new Prisma.Decimal(req.body.roomChargePaid),
          closedAt: req.body.active === false ? new Date() : undefined
        }
      });

      if (result.count === 0) {
        const existingTab = await prisma.tab.findUnique({ where: { id: tabId } });
        if (!existingTab) {
          res.status(404).json({ error: "tab_not_found" });
          return;
        }

        res.status(409).json({ error: "tab_already_paid" });
        return;
      }

      const tab = await prisma.tab.findUniqueOrThrow({ where: { id: tabId } });
      await maybeCloseRoomSessionIfSettled(tab.roomSessionId);
      broadcastAdminEvent("sessions:changed", "tab_updated");
      res.json(tabDto(tab));
      return;
    }

    const tab = await prisma.tab.update({
      where: { id: tabId },
      data: {
        paid: req.body.paid,
        active: req.body.active,
        roomChargePaid: req.body.roomChargePaid === undefined
          ? undefined
          : new Prisma.Decimal(req.body.roomChargePaid),
        closedAt: req.body.active === false ? new Date() : undefined
      }
    });
    broadcastAdminEvent("sessions:changed", "tab_updated");
    res.json(tabDto(tab));
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId/summary", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const activeSession = await getActiveRoomSession(room.id);
    if (!activeSession) {
      res.status(409).json({ error: "room_session_not_open" });
      return;
    }

    const tabs = await prisma.tab.findMany({
      where: { roomId: room.id, roomSessionId: activeSession.id, active: true },
      include: {
        orders: {
          include: { items: true },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      room: roomDto(room),
      activeSession: roomSessionDto(activeSession),
      tabs: tabs.map((tab) => {
        const itemsMap = new Map<string, { name: string; quantity: number; price: number }>();
        let totalValue = 0;

        for (const order of tab.orders) {
          if (order.status === "cancelled") continue;
          totalValue += Number(order.total);
          for (const item of order.items) {
            const key = item.name;
            const existing = itemsMap.get(key);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              itemsMap.set(key, {
                name: item.name,
                quantity: item.quantity,
                price: Number(item.price)
              });
            }
          }
        }

        return {
          id: tab.id,
          tabName: tab.tabName,
          personName: tab.personName,
          totalValue,
          paid: tab.paid,
          roomChargePaid: Number(tab.roomChargePaid),
          items: Array.from(itemsMap.values())
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/orders", requireAuth, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        roomSession: {
          active: true
        }
      },
      include: { room: true, roomSession: true, tab: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders.map(orderDto));
  } catch (error) {
    next(error);
  }
});

app.post("/orders", async (req, res, next) => {
  try {
    const room = await resolveRoom(String(req.body.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const activeSession = await getActiveRoomSession(room.id);
    if (!activeSession) {
      res.status(409).json({ error: "room_session_not_open" });
      return;
    }

    const items: CreateOrderItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];
    const total = items.reduce(
      (sum: number, item: CreateOrderItemInput) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const order = await prisma.order.create({
      data: {
        roomId: room.id,
        roomSessionId: activeSession.id,
        tabId: String(req.body.tabId),
        total: new Prisma.Decimal(total),
        items: {
          create: items.map((item: CreateOrderItemInput) => ({
            menuItemId: item.menuItemId,
            name: String(item.name),
            quantity: Number(item.quantity),
            price: new Prisma.Decimal(item.price),
            observations: item.observations
          }))
        }
      },
      include: { room: true, roomSession: true, tab: true, items: true }
    });

    broadcastAdminEvent("orders:changed", "order_created");
    broadcastAdminEvent("sessions:changed", "order_created");
    res.status(201).json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.patch("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: routeParam(req.params.id) },
      data: {
        status: req.body.status as OrderStatus | undefined,
        viewed: req.body.viewed
      },
      include: { room: true, roomSession: true, tab: true, items: true }
    });
    broadcastAdminEvent("orders:changed", "order_updated");
    broadcastAdminEvent("sessions:changed", "order_updated");
    res.json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.put("/orders/:id/items", requireAuth, async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.id);
    const items: CreateOrderItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];
    const total = items.reduce(
      (sum: number, item: CreateOrderItemInput) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      return tx.order.update({
        where: { id: orderId },
        data: {
          total: new Prisma.Decimal(total),
          items: {
            create: items.map((item: CreateOrderItemInput) => ({
              menuItemId: item.menuItemId,
              name: String(item.name),
              quantity: Number(item.quantity),
              price: new Prisma.Decimal(item.price),
              observations: item.observations
            }))
          }
        },
        include: { room: true, roomSession: true, tab: true, items: true }
      });
    });

    broadcastAdminEvent("orders:changed", "order_items_updated");
    broadcastAdminEvent("sessions:changed", "order_items_updated");
    res.json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.delete("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: routeParam(req.params.id) } });
    broadcastAdminEvent("orders:changed", "order_deleted");
    broadcastAdminEvent("sessions:changed", "order_deleted");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDistPath));

app.get(/^(?!\/(?:auth|rooms|categories|menu-items|orders|tabs|health)(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "internal_server_error" });
});

server.listen(env.port, () => {
  console.log(`API listening on port ${env.port}`);
});
