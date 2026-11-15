// Runs once when the Next.js server starts (Node.js runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupTasks } = await import("./startup");
    await runStartupTasks();
  }
}
