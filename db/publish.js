// One command to ship `development` to the live site.  Usage: npm run publish
//
// Steps: verify you're on a clean `development` -> npm run db:check ->
// fast-forward `main` to `development` -> push both branches.  Vercel sees the
// push to `main` and deploys automatically (applies pending production
// migrations via db/predeploy.js, then builds).
//
// Anything unexpected (dirty tree, failed parity check, diverged branches,
// rejected push) aborts before `main` is touched or as early as possible, and
// puts you back on `development`.

const { execSync } = require("child_process");

function sh(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}
function out(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}
function abort(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
function backToDevAndAbort(msg) {
  try {
    execSync("git checkout development", { stdio: "inherit" });
  } catch {
    /* already there, or checkout failed — nothing more we can do */
  }
  abort(msg);
}

// 1. must be on `development` with everything committed
const branch = out("git rev-parse --abbrev-ref HEAD");
if (branch !== "development") {
  abort(`You're on "${branch}". Run this from "development": git checkout development`);
}
const dirty = out("git status --porcelain");
if (dirty) {
  abort(
    "Uncommitted changes on `development` — commit or stash them first:\n" +
      dirty
        .split("\n")
        .map((l) => "    " + l)
        .join("\n"),
  );
}

// 2. production vs development database parity gate
try {
  sh("npm run db:check");
} catch {
  abort("db:check failed — resolve the drift shown above before publishing.");
}

// 3. fast-forward `main` to `development` and push
try {
  sh("git fetch origin");
} catch {
  abort("git fetch failed — check your network / GitHub auth.");
}

sh("git checkout main");

try {
  sh("git merge --ff-only development");
} catch {
  backToDevAndAbort(
    "Can't fast-forward `main` — it has commits `development` doesn't.\n" +
      "  Reconcile manually (e.g. `git checkout development && git merge main`), then retry.",
  );
}

try {
  sh("git push origin main");
} catch {
  backToDevAndAbort("Push to origin/main failed (see error above). `main` is ahead locally only.");
}

// 4. back to development and keep origin in sync
sh("git checkout development");
try {
  sh("git push origin development");
} catch {
  console.warn("\n(!) Couldn't push origin/development — not fatal, `main` is already live.");
}

console.log(`
✔ Pushed to main. Vercel is deploying now:
    1. applies any pending migrations to the PRODUCTION database
    2. builds and goes live  (~2 min)

  Watch:  https://vercel.com/dashboard  ->  travelease  ->  Deployments
  When it's green, run:  npm run db:check   (expect "IN SYNC")
`);
