import { CraftError } from "@craft/protocol";

/**
 * A placeholder for a module that a later task builds: every method throws a `CraftError`
 * (INTERNAL, naming the module and method), except the ones given in `implemented`.
 * Fails loudly and closed; never pretends to succeed.
 */
export function notBuilt<T extends object>(module: string, implemented: Partial<T> = {}): T {
  return new Proxy(implemented, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof T];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      return () => {
        throw new CraftError("INTERNAL", {}, { module, method: prop, why: "not built yet" });
      };
    },
  }) as T;
}
