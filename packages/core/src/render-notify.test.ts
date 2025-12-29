import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Notify System", () => {
  const validator = new Validator();

  describe("Basic notifications", () => {
    it("increments version on each notify call", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      const initialVersion = runtime.getVersion();

      runtime.setValue("#", "updated");
      expect(runtime.getVersion()).toBe(initialVersion + 1);

      runtime.setValue("#", "again");
      expect(runtime.getVersion()).toBe(initialVersion + 2);
    });

    it("notifies subscribers on value changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      const events: { type: string; path: string }[] = [];
      runtime.subscribe("/name", (e) => events.push(e));

      runtime.setValue("/name", "Bob");

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.type === "value" && e.path === "/name")).toBe(
        true,
      );
    });

    it("only notifies direct path subscribers", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        nested: { value: "initial" },
      });

      const rootEvents: { type: string; path: string }[] = [];
      const valueEvents: { type: string; path: string }[] = [];
      runtime.subscribe("#", (e) => rootEvents.push(e));
      runtime.subscribe("/nested/value", (e) => valueEvents.push(e));

      runtime.setValue("/nested/value", "updated");

      // Only direct path subscriber should be notified (not root)
      expect(rootEvents.length).toBe(0);
      expect(valueEvents.length).toBeGreaterThanOrEqual(1);
      expect(valueEvents.some((e) => e.path === "/nested/value")).toBe(true);
    });
  });

  describe("Multiple subscribers", () => {
    it("notifies all subscribers on same path", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let count1 = 0;
      let count2 = 0;
      let count3 = 0;

      runtime.subscribe("#", () => count1++);
      runtime.subscribe("#", () => count2++);
      runtime.subscribe("#", () => count3++);

      runtime.setValue("#", "updated");

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(1);
    });

    it("supports subscribers on different paths", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { a: "foo", b: 1 });

      let aNotified = false;
      let bNotified = false;
      let rootNotified = false;

      runtime.subscribe("/a", () => (aNotified = true));
      runtime.subscribe("/b", () => (bNotified = true));
      runtime.subscribe("#", () => (rootNotified = true));

      runtime.setValue("/a", "bar");

      expect(aNotified).toBe(true);
      expect(bNotified).toBe(false); // /b subscriber should not be notified
      expect(rootNotified).toBe(false); // root not notified for child path changes
    });
  });

  describe("Unsubscribe", () => {
    it("stops receiving notifications after unsubscribe", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let callCount = 0;
      const unsubscribe = runtime.subscribe("#", () => callCount++);

      runtime.setValue("#", "first");
      expect(callCount).toBe(1);

      unsubscribe();

      runtime.setValue("#", "second");
      expect(callCount).toBe(1); // Should not increment
    });

    it("only unsubscribes specific callback", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let count1 = 0;
      let count2 = 0;

      const unsub1 = runtime.subscribe("#", () => count1++);
      runtime.subscribe("#", () => count2++);

      runtime.setValue("#", "first");
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      unsub1();

      runtime.setValue("#", "second");
      expect(count1).toBe(1); // Should not increment
      expect(count2).toBe(2); // Should still increment
    });
  });

  describe("Error handling in callbacks", () => {
    it("continues notifying other subscribers if one throws", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let firstCalled = false;
      let thirdCalled = false;

      // Suppress console.error for this test
      const originalConsoleError = console.error;
      console.error = () => {};

      runtime.subscribe("#", () => (firstCalled = true));
      runtime.subscribe("#", () => {
        throw new Error("Test error");
      });
      runtime.subscribe("#", () => (thirdCalled = true));

      runtime.setValue("#", "updated");

      expect(firstCalled).toBe(true);
      expect(thirdCalled).toBe(true);

      console.error = originalConsoleError;
    });
  });

  describe("Event types", () => {
    it("sends value type event on setValue", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let eventType: string | null = null;
      runtime.subscribe("#", (e) => (eventType = e.type));

      runtime.setValue("#", "updated");

      expect(eventType).toBe("value");
    });

    it("sends schema type event on updateSchema", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "test");

      let eventType: string | null = null;
      // updateSchema notifies on "#" which normalizes to ""
      runtime.subscribe("", (e) => (eventType = e.type));

      runtime.setSchema({ type: "number" });

      expect(eventType).toBe("schema");
    });

    it("sends schema type event when conditional schema changes", () => {
      const schema: Schema = {
        type: "object",
        if: { properties: { type: { const: "A" } } },
        then: { properties: { value: { type: "string" } } },
        else: { properties: { value: { type: "number" } } },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        type: "A",
        value: "hello",
      });

      // Initial state: type A -> then branch -> value is string
      expect(runtime.findNode("/value")?.schema.type).toBe("string");

      const events: { type: string; path: string }[] = [];
      // Subscribe to root to receive all events
      runtime.subscribe("", (e) => events.push(e));

      // Change type to B -> else branch -> value is number
      runtime.setValue("/type", "B");

      // Verify schema actually changed
      expect(runtime.findNode("/value")?.schema.type).toBe("number");

      // Should have received a schema change event (path will be "" for root)
      expect(events.some((e) => e.type === "schema" && e.path === "")).toBe(
        true,
      );
    });
  });

  describe("Version tracking", () => {
    it("maintains consistent version across multiple operations", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { a: "x", b: 1 });

      const v0 = runtime.getVersion();

      runtime.setValue("/a", "y");
      const v1 = runtime.getVersion();
      expect(v1).toBeGreaterThan(v0);

      runtime.setValue("/b", 2);
      const v2 = runtime.getVersion();
      expect(v2).toBeGreaterThan(v1);

      runtime.setSchema({
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "string" },
        },
      });
      const v3 = runtime.getVersion();
      expect(v3).toBeGreaterThan(v2);
    });
  });
});
