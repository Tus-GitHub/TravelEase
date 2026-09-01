// Registers the TS resolution hook (see _ts-loader.mjs) on the module loader so
// the DB test harness can import the app's `src/lib/server/**` TypeScript
// modules directly. Used via:  node --experimental-strip-types --import ./db/tests/_register.mjs ...
import { register } from "node:module";

register("./_ts-loader.mjs", import.meta.url);
