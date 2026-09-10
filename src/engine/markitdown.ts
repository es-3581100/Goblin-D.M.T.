import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

function run(command: string, args: string[], capture = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"] })
    let out = "", err = ""
    child.stdout?.on("data", (b: any) => out += b.toString())
    child.stderr?.on("data", (b: any) => err += b.toString())
    child.on("error", (e: Error) => reject(new Error(`cannot run ${command}: ${e.message}`)))
    child.on("close", (code: number | null) => code === 0 ? resolve(out) : reject(new Error(`${command} exited ${code}: ${err.trim()}`)))
  })
}

export async function markitdown(file: string, command = "markitdown", mode: "go" | "stdout" = "go"): Promise<string> {
  const ext = path.extname(file).toLowerCase()
  if ([".md", ".markdown", ".txt"].includes(ext)) return readFile(file, "utf8")
  if (mode === "stdout") return run(command, [file], true)
  const temp = await mkdtemp(path.join(os.tmpdir(), "dmt-markitdown-"))
  const output = path.join(temp, "converted.md")
  try {
    await run(command, [file, output], false)
    return await readFile(output, "utf8")
  } finally { await rm(temp, { recursive: true, force: true }) }
}
