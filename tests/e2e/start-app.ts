import { spawn, type ChildProcess } from "node:child_process";

// Override inherited configuration in memory, including NEXT_PUBLIC values at
// build time. Never read, write or copy .env.local into the test harness.
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_browser_test_only",
};
let child: ChildProcess;
function run(args: string[]) {
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env, stdio: "inherit" });
  return child;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { child?.kill(signal); process.exit(0); });
}
run(["build"]).on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  run(["start", "--hostname", "127.0.0.1", "--port", "3100"]).on("exit", (status) => process.exit(status ?? 1));
});
