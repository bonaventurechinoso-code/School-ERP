export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { execFile } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.resolve(process.cwd(), "scripts", "init-superadmin.js");
      execFile(process.execPath, [scriptPath], (err, stdout) => {
        if (stdout && stdout.trim()) {
          console.log(stdout.trim());
        }
      });
    } catch {
      // Fail-safe execution
    }
  }
}
