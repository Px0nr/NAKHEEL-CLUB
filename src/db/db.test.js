import { describe, it, expect, vi, beforeEach } from "vitest";
import { DB } from "./db.js";

describe("DB realtime subscriber mechanism", () => {
  beforeEach(() => {
    DB.subscribers = {};
    DB.cache = {};
  });

  it("notifies a subscribed callback when a remote change arrives", () => {
    const cb = vi.fn();
    DB.onRemoteChange("products", cb);
    DB._applyRemote("products", [{ id: 1, name: "test" }]);
    expect(cb).toHaveBeenCalledWith([{ id: 1, name: "test" }]);
  });

  it("updates the in-memory cache so later reads see the remote value", () => {
    DB._applyRemote("settings", { theme: "dark" });
    expect(DB.cache.settings).toEqual({ theme: "dark" });
  });

  it("does not notify subscribers of a different key", () => {
    const cb = vi.fn();
    DB.onRemoteChange("products", cb);
    DB._applyRemote("customers", []);
    expect(cb).not.toHaveBeenCalled();
  });

  it("notifies every subscriber registered for the same key", () => {
    const cb1 = vi.fn(); const cb2 = vi.fn();
    DB.onRemoteChange("invoices", cb1);
    DB.onRemoteChange("invoices", cb2);
    DB._applyRemote("invoices", [1, 2, 3]);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("stops notifying once unsubscribed", () => {
    const cb = vi.fn();
    const unsubscribe = DB.onRemoteChange("products", cb);
    unsubscribe();
    DB._applyRemote("products", []);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not let a throwing subscriber break other subscribers", () => {
    const good = vi.fn();
    DB.onRemoteChange("products", () => { throw new Error("boom"); });
    DB.onRemoteChange("products", good);
    expect(() => DB._applyRemote("products", [])).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});
