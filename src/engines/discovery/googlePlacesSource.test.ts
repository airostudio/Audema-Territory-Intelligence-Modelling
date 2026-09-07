import { describe, expect, it } from "vitest";
import { componentByType } from "./googlePlacesSource.js";

describe("componentByType", () => {
  it("finds a component by type", () => {
    const components = [{ longText: "Geelong", shortText: "Geelong", types: ["locality", "political"] }];
    expect(componentByType(components, "locality")).toBe("Geelong");
  });

  it("returns undefined when no component matches", () => {
    const components = [{ longText: "Australia", shortText: "AU", types: ["country"] }];
    expect(componentByType(components, "locality")).toBeUndefined();
  });

  it("does not throw when a component is missing its types array (a real Google Places API response shape, not just the documented one)", () => {
    // TS types this field as required, but the actual JSON response is an unchecked cast —
    // this reproduces the production crash: "Cannot read properties of undefined (reading 'includes')".
    const components = [{ longText: "Geelong", shortText: "Geelong" } as { longText: string; shortText: string; types?: string[] }];
    expect(() => componentByType(components, "locality")).not.toThrow();
    expect(componentByType(components, "locality")).toBeUndefined();
  });

  it("returns undefined for an undefined components array", () => {
    expect(componentByType(undefined, "locality")).toBeUndefined();
  });
});
