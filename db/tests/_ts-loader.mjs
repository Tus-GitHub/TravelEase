// ESM resolution hook: lets the DB test harness import the app's
// `src/lib/server/**` TypeScript modules, which use extensionless relative
// specifiers like `../db`. Node's native type-stripping does not resolve those,
// so we append `.ts` when a sibling `.ts` file exists.
//
// Registered by _register.mjs. Run Node with:
//   node --experimental-strip-types --import ./db/tests/_register.mjs <file>
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
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
