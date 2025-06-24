import { describe, it } from "vitest";
import { mergeOptions } from "../src/utils";

describe.concurrent("mergeOptions", () => {
  it("should return defaultOptions if options is undefined", ({ expect }) => {
    const defaults = { a: 1, b: 2 };
    const result = mergeOptions(undefined, defaults);
    expect(result).toEqual(defaults);
  });

  it("should return options if defaultOptions is undefined", ({ expect }) => {
    const opts = { a: 3, b: 4 };
    const result = mergeOptions(opts, undefined);
    expect(result).toEqual(opts);
  });

  it("should deeply merge nested objects", ({ expect }) => {
    const defaults = { a: 1, b: { c: 2, d: 3 } };
    const opts = { b: { c: 5 } };
    const result = mergeOptions(opts, defaults);
    expect(result).toEqual({ a: 1, b: { c: 5, d: 3 } });
  });

  it("should override primitive values", ({ expect }) => {
    const defaults = { a: 1, b: 2 };
    const opts = { b: 5 };
    const result = mergeOptions(opts, defaults);
    expect(result).toEqual({ a: 1, b: 5 });
  });

  it("should not merge arrays, but override them", ({ expect }) => {
    const defaults = { arr: [1, 2, 3], b: 2 };
    const opts = { arr: [4, 5] };
    const result = mergeOptions(opts, defaults);
    expect(result).toEqual({ arr: [4, 5], b: 2 });
  });

  it("should handle null and undefined values in options", ({ expect }) => {
    const defaults = { a: 1, b: 2 };
    const opts = { a: null, b: undefined };
    const result = mergeOptions(opts, defaults as any);
    expect(result).toEqual({ a: null, b: undefined });
  });

  it("should handle both options and defaultOptions as undefined", ({ expect }) => {
    const result = mergeOptions(undefined, undefined);
    expect(result).toEqual({});
  });

  it("should not mutate the input objects", ({ expect }) => {
    const defaults = { a: 1, b: { c: 2 } };
    const opts = { b: { d: 3 } };
    const defaultsCopy = JSON.parse(JSON.stringify(defaults));
    const optsCopy = JSON.parse(JSON.stringify(opts));
    mergeOptions(opts, defaults as any);
    expect(defaults).toEqual(defaultsCopy);
    expect(opts).toEqual(optsCopy);
  });
});
