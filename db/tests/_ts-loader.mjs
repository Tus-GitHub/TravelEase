// ESM resolution hook: lets the DB test harness import the app's
// `src/lib/server/**` TypeScript modules, which use extensionless relative
// specifiers like `../db` and the `@/…` path alias. Node's native type-stripping
// resolves neither, so we (a) map `@/x` to `<repo>/src/x[.ts]` and (b) append
// `.ts` to a relative specifier when a sibling `.ts` file exists.
//
// Registered by _register.mjs. Run Node with:
//   node --experimental-strip-types --import ./db/tests/_register.mjs <file>
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// db/tests/  ->  <repo>/src/
const SRC = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  // Path alias `@/x` -> <repo>/src/x, trying common extensions / index files.
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    for (const cand of [rest, `${rest}.ts`, `${rest}.tsx`, `${rest}/index.ts`]) {
      const url = new URL(cand, SRC);
      if (existsSync(fileURLToPath(url))) {
        return { url: url.href, shortCircuit: true };
      }
    }
  }

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasKnownExt = /\.[cm]?[jt]s$/i.test(specifier) || /\.json$/i.test(specifier);
  if (isRelative && !hasKnownExt && context.parentURL) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
