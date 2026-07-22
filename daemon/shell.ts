import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Wrapper minimo sobre spawn que nunca tira excepcion por exit code.
 * Devolvemos el resultado y decide quien llama.
 */
export function run(
  cmd: string,
  args: string[] = [],
  input?: string,
): Promise<RunResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      resolve({ code: 127, stdout: "", stderr: "no se pudo ejecutar " + cmd });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("error", () => {
      resolve({ code: 127, stdout, stderr: cmd + " no esta instalado" });
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });

    if (input !== undefined) child.stdin?.write(input);
    child.stdin?.end();
  });
}

/** Existe este binario en el PATH? */
export async function has(cmd: string): Promise<boolean> {
  const { code } = await run("which", [cmd]);
  return code === 0;
}
