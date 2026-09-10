import { cp, mkdir, readFile, readdir, stat, rm } from "node:fs/promises"
import path from "node:path"
import { atomicWrite, sha256, slug } from "./util.js"
import type { STFConfig, STFRunState } from "./types.js"

export class StorageActor {
  readonly root: string
  readonly config: STFConfig
  readonly base: string
  constructor(root: string, config: STFConfig) {
    this.root = root
    this.config = config
    this.base = path.resolve(root, config.stateDir)
  }

  async init(): Promise<void> {
    await Promise.all([
      mkdir(path.join(this.base, "runs"), { recursive: true }),
      mkdir(path.join(this.base, "prompts"), { recursive: true }),
      mkdir(path.join(this.base, "cache"), { recursive: true })
    ])
  }

  /** Cross-process lock used by the OpenCode host and user CLI so canonical state has one writer at a time. */
  async withStateLock<T>(fn: () => Promise<T>, timeoutMs = 4000): Promise<T> {
    await this.init()
    const lock = path.join(this.base, ".state-lock")
    const started = Date.now()
    while (true) {
      try {
        await mkdir(lock)
        break
      } catch (err: any) {
        if (err?.code !== "EEXIST") throw err
        if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for STF state lock: ${lock}`)
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    }
    try {
      return await fn()
    } finally {
      await rm(lock, { recursive: true, force: true })
    }
  }

  async saveState(state: STFRunState): Promise<string> {
    await this.init()
    const dir = path.join(this.base, "runs", state.runId)
    await mkdir(dir, { recursive: true })
    const stateJson = JSON.stringify(state, null, 2) + "\n"
    await atomicWrite(path.join(dir, "state.json"), stateJson)
    await atomicWrite(
      path.join(this.base, "current.json"),
      JSON.stringify({ runId: state.runId, phase: state.phase, updatedAt: state.updatedAt }, null, 2) + "\n"
    )
    const events = state.ledger.map(x => JSON.stringify(x)).join("\n") + (state.ledger.length ? "\n" : "")
    await atomicWrite(path.join(dir, "events.ndjson"), events)
    if (state.latent.formatted) await atomicWrite(path.join(dir, "artifact.md"), state.latent.formatted)
    if (state.latent.decoded) await atomicWrite(path.join(dir, "decoded.md"), state.latent.decoded)
    return dir
  }

  async loadCurrent(): Promise<STFRunState | undefined> {
    try {
      const current = JSON.parse(await readFile(path.join(this.base, "current.json"), "utf8"))
      return JSON.parse(await readFile(path.join(this.base, "runs", current.runId, "state.json"), "utf8"))
    } catch (err: any) {
      if (err?.code === "ENOENT") return undefined
      throw err
    }
  }

  async loadRun(runId: string): Promise<STFRunState> {
    return JSON.parse(await readFile(path.join(this.base, "runs", slug(runId), "state.json"), "utf8"))
  }

  async savePrompt(name: string, content: string, source = "stdin"): Promise<{name: string, file: string, sha256: string}> {
    await this.init()
    const safe = slug(name)
    const file = path.join(this.base, "prompts", `${safe}.md`)
    const hash = sha256(content)
    await atomicWrite(file, content)
    await atomicWrite(
      path.join(this.base, "prompts", `${safe}.meta.json`),
      JSON.stringify({ name: safe, source, sha256: hash, updatedAt: new Date().toISOString() }, null, 2) + "\n"
    )
    return { name: safe, file, sha256: hash }
  }

  async loadPrompt(name: string): Promise<string> {
    return readFile(path.join(this.base, "prompts", `${slug(name)}.md`), "utf8")
  }

  async listPrompts(): Promise<string[]> {
    await this.init()
    return (await readdir(path.join(this.base, "prompts")))
      .filter((x: string) => x.endsWith(".md"))
      .map((x: string) => x.slice(0, -3))
      .sort()
  }

  async push(kind: "prompt" | "run", name: string, remoteDir?: string, overwrite = false): Promise<string> {
    const remoteValue = remoteDir ?? this.config.remoteDir
    if (!remoteValue) throw new Error("no remoteDir configured or supplied")
    const remote = path.resolve(this.root, remoteValue)
    const safe = slug(name)
    const src = kind === "prompt" ? path.join(this.base, "prompts", `${safe}.md`) : path.join(this.base, "runs", safe)
    const dst = kind === "prompt" ? path.join(remote, "prompts", `${safe}.md`) : path.join(remote, "runs", safe)
    try {
      await stat(dst)
      if (!overwrite) throw new Error(`destination exists: ${dst}; pass --overwrite`)
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e
    }
    await mkdir(path.dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: true, force: overwrite, errorOnExist: !overwrite })
    if (kind === "prompt") {
      const metaSrc = path.join(this.base, "prompts", `${safe}.meta.json`)
      const metaDst = path.join(remote, "prompts", `${safe}.meta.json`)
      try { await cp(metaSrc, metaDst, { force: overwrite, errorOnExist: !overwrite }) } catch (e: any) { if (e?.code !== "ENOENT") throw e }
    }
    return dst
  }

  async pull(kind: "prompt" | "run", name: string, remoteDir?: string, overwrite = false): Promise<string> {
    const remoteValue = remoteDir ?? this.config.remoteDir
    if (!remoteValue) throw new Error("no remoteDir configured or supplied")
    const remote = path.resolve(this.root, remoteValue)
    const safe = slug(name)
    const src = kind === "prompt" ? path.join(remote, "prompts", `${safe}.md`) : path.join(remote, "runs", safe)
    const dst = kind === "prompt" ? path.join(this.base, "prompts", `${safe}.md`) : path.join(this.base, "runs", safe)
    try {
      await stat(dst)
      if (!overwrite) throw new Error(`destination exists: ${dst}; pass --overwrite`)
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e
    }
    await mkdir(path.dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: true, force: overwrite, errorOnExist: !overwrite })
    if (kind === "prompt") {
      const metaSrc = path.join(remote, "prompts", `${safe}.meta.json`)
      const metaDst = path.join(this.base, "prompts", `${safe}.meta.json`)
      try { await cp(metaSrc, metaDst, { force: overwrite, errorOnExist: !overwrite }) } catch (e: any) { if (e?.code !== "ENOENT") throw e }
    }
    return dst
  }
}
