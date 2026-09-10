import { readFile } from "node:fs/promises"
import path from "node:path"
import { DEFAULT_CONFIG, type STFConfig } from "./types.js"

export async function loadConfig(root: string): Promise<STFConfig> {
  const canonical = path.join(root, ".g-dmt", "config.json")
  const legacy = path.join(root, ".stable-text-fusion", "config.json")
  for (const file of [canonical, legacy]) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8"))
      return { ...DEFAULT_CONFIG, ...parsed, mutationTools: parsed.mutationTools ?? DEFAULT_CONFIG.mutationTools }
    } catch (err: any) {
      if (err?.code === "ENOENT") continue
      throw new Error(`invalid Goblin-D.M.T. config ${file}: ${err.message}`)
    }
  }
  return { ...DEFAULT_CONFIG }
}
