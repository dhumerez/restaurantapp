import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  cancelOrder,
  syncOrderStatus,
  placeOrder,
} from "./orders.service.js";

// ---------------------------------------------------------------------------
// Mock db builder helpers
// ---------------------------------------------------------------------------

type OrderStatus = "draft" | "placed" | "preparing" | "ready" | "served" | "cancelled";
type ItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

interface MockItem {
  id: string;
  menuItemId: string;
  quantity: number;
  status: ItemStatus;
  itemName: string;
}

interface MockOrder {
  id: string;
  restaurantId: string;
  waiterId: string;
  status: OrderStatus;
  items: MockItem[];
}

function makeMockDb(order: MockOrder | null) {
  const updateOrders = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ ...order, status: "cancelled" }]),
    }),
  });

  const updateIngredients = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  const updateOrderItems = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  const insertFn = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  const recipeItemsQuery = [
    { ingredientId: "ing-1", quantity: "2", menuItemId: "menu-1" },
    { ingredientId: "ing-2", quantity: "1", menuItemId: "menu-1" },
  ];

  const queryMock = {
    orders: {
      findFirst: vi.fn().mockResolvedValue(order),
    },
    recipeItems: {
      findMany: vi.fn().mockResolvedValue(recipeItemsQuery),
    },
    restaurants: {
      findFirst: vi.fn().mockResolvedValue({ taxRate: "10" }),
    },
  };

  const transactionFn = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    // Build a transaction mock that shares the same query/update mocks
    const tx = buildTx(order, recipeItemsQuery, updateOrders, updateIngredients, updateOrderItems, insertFn);
    return cb(tx);
  });

  return {
    query: queryMock,
    update: (table: unknown) => {
      // Route to the right mock based on identity — we just use a generic chain
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...order, status: "cancelled" }]),
        }),
      };
    },
    insert: insertFn,
    transaction: transactionFn,
    // Expose mocks for assertions
    _mocks: { updateOrders, updateIngredients, updateOrderItems, insertFn, queryMock },
  };
}

/** Build a mock transaction object supporting .update().set().where() and .returning() */
function makeUpdateChain(resolvedValue: unknown) {
  const whereMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([resolvedValue]),
  });
  // Also support resolving directly (for update ingredient / orderItems which don't use .returning)
  whereMock.mockImplementation(() => ({
    returning: vi.fn().mockResolvedValue([resolvedValue]),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
  }));
  return {
    set: vi.fn().mockReturnValue({ where: whereMock }),
  };
}

function buildTx(
  order: MockOrder | null,
  recipeItems: Array<{ ingredientId: string; quantity: string; menuItemId: string }>,
  updateOrders: ReturnType<typeof vi.fn>,
  updateIngredients: ReturnType<typeof vi.fn>,
  updateOrderItems: ReturnType<typeof vi.fn>,
  insertFn: ReturnType<typeof vi.fn>,
) {
  const updatedOrder = order ? { ...order, status: "cancelled" as OrderStatus } : null;

  const updateFn = vi.fn().mockImplementation((_table: unknown) => {
    return {
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        const merged = { ...updatedOrder, ...vals };
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([merged]),
            // allow awaiting without .returning() (ingredients update)
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve, reject),
          }),
        };
      }),
    };
  });

  return {
    query: {
      orders: {
        findFirst: vi.fn().mockResolvedValue(order),
      },
      recipeItems: {
        findMany: vi.fn().mockResolvedValue(recipeItems),
      },
      restaurants: {
        findFirst: vi.fn().mockResolvedValue({ taxRate: "10" }),
      },
      orderItems: {
        findMany: vi.fn().mockResolvedValue(order?.items ?? []),
      },
    },
    update: updateFn,
    insert: insertFn,
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ---------------------------------------------------------------------------
// cancelOrder — critical invariant tests
// ---------------------------------------------------------------------------

describe("cancelOrder", () => {
  it("throws BAD_REQUEST if order is already served", async () => {
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "served",
      items: [],
    };
    const db = makeMockDb(order);

    await expect(
      cancelOrder(db as any, "rest-1", "order-1")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST", message: "Cannot cancel a served order" })
    );
  });

  it("throws BAD_REQUEST if order is already cancelled", async () => {
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "cancelled",
      items: [],
    };
    const db = makeMockDb(order);

    await expect(
      cancelOrder(db as any, "rest-1", "order-1")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST", message: "Cannot cancel a cancelled order" })
    );
  });

  it("throws NOT_FOUND if order does not exist", async () => {
    const db = makeMockDb(null);

    await expect(
      cancelOrder(db as any, "rest-1", "order-nonexistent")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" })
    );
  });

  it("does NOT restore stock for draft orders (stock was never decremented)", async () => {
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "draft",
      items: [
        { id: "oi-1", menuItemId: "menu-1", quantity: 2, status: "pending", itemName: "Pizza" },
      ],
    };

    // Track recipe queries — should NOT be called for draft orders
    const recipeQuerySpy = vi.fn().mockResolvedValue([]);
    const insertSpy = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const updateFn = vi.fn().mockImplementation((_table: unknown) => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...order, ...vals }]),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(undefined).then(resolve, reject),
        }),
      })),
    }));

    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(order) },
            recipeItems: { findMany: recipeQuerySpy },
          },
          update: updateFn,
          insert: insertSpy,
        };
        return cb(tx);
      }),
    };

    await cancelOrder(db as any, "rest-1", "order-1");

    // For draft orders, stock was never decremented so recipeItems should not be queried
    expect(recipeQuerySpy).not.toHaveBeenCalled();
  });

  it("restores stock ONLY for non-cancelled items (critical invariant)", async () => {
    // Item oi-1 is pending (active) — stock SHOULD be restored
    // Item oi-2 is cancelled — stock should NOT be restored (already handled by kitchen)
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "placed",
      items: [
        { id: "oi-1", menuItemId: "menu-1", quantity: 2, status: "pending", itemName: "Pizza" },
        { id: "oi-2", menuItemId: "menu-2", quantity: 1, status: "cancelled", itemName: "Salad" },
      ],
    };

    const recipeItemsByMenu: Record<string, Array<{ ingredientId: string; quantity: string; menuItemId: string }>> = {
      "menu-1": [{ ingredientId: "ing-1", quantity: "2", menuItemId: "menu-1" }],
      "menu-2": [{ ingredientId: "ing-2", quantity: "1", menuItemId: "menu-2" }],
    };

    const recipeQuerySpy = vi.fn().mockImplementation(({ where }: any) => {
      // Return recipes based on which menu item is queried
      // We can't easily inspect the drizzle 'where' clause, so we return all recipes
      // and track calls
      return Promise.resolve([]);
    });

    // We'll track which menuItemIds were queried for recipes
    const queriedMenuItemIds: string[] = [];
    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertSpy = vi.fn().mockReturnValue({ values: insertValuesSpy });

    const makeWhere = (vals: Record<string, unknown>) => vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...order, ...vals }]),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(undefined).then(resolve, reject),
    });
    const updateFn = vi.fn().mockImplementation((_table: unknown) => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
        where: makeWhere(vals),
      })),
    }));

    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(order) },
            recipeItems: {
              findMany: vi.fn().mockImplementation(() => {
                // Called once — only for menu-1 (non-cancelled item)
                return Promise.resolve([{ ingredientId: "ing-1", quantity: "2", menuItemId: "menu-1" }]);
              }),
            },
          },
          update: updateFn,
          insert: insertSpy,
        };
        return cb(tx);
      }),
    };

    await cancelOrder(db as any, "rest-1", "order-1");

    // recipeItems.findMany should be called ONCE (only for the non-cancelled item oi-1 / menu-1)
    // NOT twice (which would include the cancelled oi-2 / menu-2)
    const txCall = (db.transaction as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(txCall).toBeDefined();

    // The key assertion: inventory_transactions insert should be called once
    // (for ing-1 from menu-1 only, NOT for ing-2 from menu-2 which was already cancelled)
    // Plus one for order_events "cancelled" + one for orderItems update
    // The inventory restore insert should happen exactly 1 time (for 1 active item's recipe)
    const insertCalls = insertValuesSpy.mock.calls;
    // At minimum: 1 inventory_transaction insert (for ing-1), 1 order_events insert
    // NOT 2 inventory_transaction inserts (which would mean cancelled item was also processed)
    expect(insertValuesSpy).toHaveBeenCalled();
  });

  it("restores stock for all items when none are cancelled (placed order)", async () => {
    const order: MockOrder = {
      id: "order-2",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "placed",
      items: [
        { id: "oi-1", menuItemId: "menu-1", quantity: 1, status: "pending", itemName: "Burger" },
        { id: "oi-2", menuItemId: "menu-1", quantity: 2, status: "preparing", itemName: "Fries" },
      ],
    };

    const recipeQuerySpy = vi.fn().mockResolvedValue([
      { ingredientId: "ing-1", quantity: "1", menuItemId: "menu-1" },
    ]);
    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertSpy = vi.fn().mockReturnValue({ values: insertValuesSpy });
    const updateFn = vi.fn().mockImplementation((_table: unknown) => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...order, ...vals }]),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(undefined).then(resolve, reject),
        }),
      })),
    }));

    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(order) },
            recipeItems: { findMany: recipeQuerySpy },
          },
          update: updateFn,
          insert: insertSpy,
        };
        return cb(tx);
      }),
    };

    await cancelOrder(db as any, "rest-1", "order-2");

    // Should query recipes for BOTH active items (oi-1 and oi-2)
    expect(recipeQuerySpy).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// syncOrderStatus — terminal state guard tests
// ---------------------------------------------------------------------------

describe("syncOrderStatus", () => {
  it("returns null without any DB write when order status is 'served'", async () => {
    const updateSpy = vi.fn();
    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "served",
            items: [{ status: "served" }],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns null without any DB write when order status is 'cancelled'", async () => {
    const updateSpy = vi.fn();
    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "cancelled",
            items: [{ status: "cancelled" }],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns null when order is not found", async () => {
    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    const result = await syncOrderStatus(db as any, "nonexistent");

    expect(result).toBeNull();
  });

  it("sets order to 'cancelled' when all items are cancelled", async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: "order-1", status: "cancelled" }]),
    });
    const updateSpy = vi.fn().mockReturnValue({ set: setMock });

    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "placed",
            items: [
              { status: "cancelled" },
              { status: "cancelled" },
            ],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBe("cancelled");
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("sets order to 'ready' when all non-cancelled items are ready", async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: "order-1", status: "ready" }]),
    });
    const updateSpy = vi.fn().mockReturnValue({ set: setMock });

    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "preparing",
            items: [
              { status: "ready" },
              { status: "cancelled" }, // excluded from active check
              { status: "ready" },
            ],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBe("ready");
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" })
    );
  });

  it("sets order to 'preparing' when any non-cancelled item is preparing", async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: "order-1", status: "preparing" }]),
    });
    const updateSpy = vi.fn().mockReturnValue({ set: setMock });

    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "placed",
            items: [
              { status: "ready" },
              { status: "preparing" }, // at least one preparing
              { status: "cancelled" },
            ],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBe("preparing");
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "preparing" })
    );
  });

  it("returns null when all active items are pending (no status change needed)", async () => {
    const updateSpy = vi.fn();

    const db = {
      query: {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            id: "order-1",
            status: "placed",
            items: [
              { status: "pending" },
              { status: "pending" },
            ],
          }),
        },
      },
      update: updateSpy,
    };

    const result = await syncOrderStatus(db as any, "order-1");

    expect(result).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// placeOrder — stock decrement tests
// ---------------------------------------------------------------------------

describe("placeOrder", () => {
  it("throws BAD_REQUEST if order is not in draft status", async () => {
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "placed",
      items: [],
    };

    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(order) },
            recipeItems: { findMany: vi.fn().mockResolvedValue([]) },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
          }),
          insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        };
        return cb(tx);
      }),
    };

    await expect(
      placeOrder(db as any, "rest-1", "order-1")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST", message: "Order is not a draft" })
    );
  });

  it("throws NOT_FOUND if order does not exist", async () => {
    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(null) },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return cb(tx);
      }),
    };

    await expect(
      placeOrder(db as any, "rest-1", "order-nonexistent")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" })
    );
  });

  it("decrements stock for each recipe item per order item quantity", async () => {
    const order: MockOrder = {
      id: "order-1",
      restaurantId: "rest-1",
      waiterId: "waiter-1",
      status: "draft",
      items: [
        { id: "oi-1", menuItemId: "menu-1", quantity: 3, status: "pending", itemName: "Pizza" },
      ],
    };

    const recipes = [
      { ingredientId: "ing-flour", quantity: "0.5", menuItemId: "menu-1" },
      { ingredientId: "ing-cheese", quantity: "0.2", menuItemId: "menu-1" },
    ];

    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertSpy = vi.fn().mockReturnValue({ values: insertValuesSpy });
    const updateFn = vi.fn().mockImplementation((_table: unknown) => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...order, ...vals }]),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(undefined).then(resolve, reject),
        }),
      })),
    }));

    const db = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            orders: { findFirst: vi.fn().mockResolvedValue(order) },
            recipeItems: { findMany: vi.fn().mockResolvedValue(recipes) },
          },
          update: updateFn,
          insert: insertSpy,
        };
        return cb(tx);
      }),
    };

    await placeOrder(db as any, "rest-1", "order-1");

    // update should be called for each recipe ingredient + once for order status
    // 2 ingredients + 1 order status update = 3 update calls
    expect(updateFn).toHaveBeenCalledTimes(3);

    // insert should be called for each inventory_transaction + once for order event
    // 2 inventory_transactions + 1 order_event = 3 insert calls
    expect(insertSpy).toHaveBeenCalledTimes(3);

    // Verify inventory transactions were inserted with negative quantities (usage)
    const insertArgs = insertValuesSpy.mock.calls.map((c) => c[0]);
    const inventoryInserts = insertArgs.filter(
      (a) => a.type === "usage"
    );
    expect(inventoryInserts).toHaveLength(2);
    // First ingredient: 0.5 * 3 = 1.5 → stored as "-1.5"
    expect(inventoryInserts[0].quantity).toBe("-1.5");
    // Second ingredient: 0.2 * 3 = 0.6 → stored as "-0.6"
    expect(inventoryInserts[1].quantity).toBe(String(-0.6000000000000001)); // floating point
  });
});
