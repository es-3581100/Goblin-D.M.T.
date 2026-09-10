#!/usr/bin/env node
import { readFile, mkdir, copyFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { StableTextFusionRuntime } from "./engine/runtime.js"
import { markitdown } from "./engine/markitdown.js"
import { formatMarkdown, formatOutput } from "./engine/format.js"
import type { STFEvent, STFMode, STFStrength } from "./engine/types.js"

const args: string[] = process.argv.slice(2)
const cmd = args.shift() ?? "help"
const cwd = process.cwd()

function flag(name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
function has(name: string): boolean { return args.includes(name) }
function positional(): string[] {
  const skip = new Set<number>()
  args.forEach((a, i) => {
    if (a.startsWith("--")) {
      skip.add(i)
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) skip.add(i + 1)
    }
  })
  return args.filter((_a, i) => !skip.has(i))
}
async function readStdin(): Promise<string> {
  let out = ""
  for await (const chunk of process.stdin) out += chunk
  return out
}
function print(x: unknown) {
  process.stdout.write(typeof x === "string" ? x : JSON.stringify(x, null, 2) + "\n")
}

async function runOpenCode(prompt: string) {
  const pass: string[] = ["run"]
  const model = flag("--model"), agent = flag("--agent")
  const host = flag("--host") ?? "v1"
  const binary = flag("--bin") ?? (host === "v2" ? "opencode2" : "opencode")
  if (!["v1", "v2"].includes(host)) throw new Error("--host must be v1|v2")
  if (model) pass.push("--model", model)
  if (agent) pass.push("--agent", agent)
  pass.push(prompt)
  await new Promise<void>((resolve, reject) => {
    const p = spawn(binary, pass, { stdio: "inherit", shell: false })
    p.on("error", reject)
    p.on("close", (code: number | null) => code === 0 ? resolve() : reject(new Error(`opencode exited ${code}`)))
  })
}

async function initProject() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const assetRoot = path.resolve(here, "../assets")
  const skillDir = path.join(cwd, ".opencode", "skills", "g-dmt")
  await mkdir(skillDir, { recursive: true })
  await copyFile(path.join(assetRoot, "opencode", "skills", "g-dmt", "SKILL.md"), path.join(skillDir, "SKILL.md"))
  const agentDir = path.join(cwd, ".opencode", "agents")
  await mkdir(agentDir, { recursive: true })
  const agentFile = path.join(agentDir, "g-dmt.md")
  await copyFile(path.join(assetRoot, "opencode", "agents", "g-dmt.md"), agentFile)
  await mkdir(path.join(cwd, ".g-dmt"), { recursive: true })
  const cfg = path.join(cwd, ".g-dmt", "config.json")
  try { await readFile(cfg) } catch { await copyFile(path.join(assetRoot, "config.default.json"), cfg) }
  print(`Installed skill: ${skillDir}\nInstalled agent: ${agentFile}\nConfig: ${cfg}\n\nOpenCode stable (1.18.30+) config key:\n  { "plugin": ["dmt"] }\nOr run:\n  opencode plugin dmt\n\nOpenCode 2 beta uses the same package through its dual-host entrypoint and native config key:\n  { "plugins": ["dmt"] }\n`)
}

async function main() {
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    print(`Goblin-D.M.T. / dmt (legacy aliases: g-dmt, stf, stable-text-fusion)\n\nCommands:\n  init\n  begin --mode plan|debug|brainstorm|develop [--strength local] <goal>\n  state\n  transition EVENT [--patch JSON]\n  approve commit\n  checkpoint\n  format [--profile markdown|plain|json] [FILE|-]\n  ingest FILE... [--save NAME] [--stdout]\n  prompt save NAME [FILE|-]\n  prompt load NAME\n  prompt list\n  skills catalog\n  skills route [TASK] [--explicit SKILL] [--available JSON]\n  skills event activate|complete|fail SKILL [--reason TEXT]\n  emit [RUN_ID]\n  push prompt|run NAME [--remote DIR] [--overwrite]\n  pull prompt|run NAME [--remote DIR] [--overwrite]\n  opencode --prompt NAME [--model provider/model] [--agent name] [--host v1|v2] [--bin PATH]\n\nPipes:\n  dmt ingest design.pdf --stdout | dmt prompt save design -\n  dmt prompt load design | your-command\n`)
    return
  }
  if (cmd === "init") return initProject()

  const rt = await StableTextFusionRuntime.create(cwd)
  const pos = positional()

  if (cmd === "begin") {
    const goal = pos.join(" ")
    if (!goal) throw new Error("begin requires a goal")
    return print(await rt.begin({
      goal,
      mode: (flag("--mode") ?? "plan") as STFMode,
      strength: flag("--strength") as STFStrength | undefined,
      source: flag("--source")
    }, "USER"))
  }
  if (cmd === "state") return print(await rt.state())
  if (cmd === "transition") {
    const event = pos[0] as STFEvent
    if (!event) throw new Error("transition requires EVENT")
    return print(await rt.transition(event, flag("--patch") ? JSON.parse(flag("--patch")!) : {}, "USER"))
  }
  if (cmd === "approve") {
    if (pos[0] !== "commit") throw new Error("only `approve commit` is supported")
    return print(await rt.approveCommit())
  }
  if (cmd === "checkpoint") {
    const s = (await rt.state()).state
    const dir = await rt.storage.saveState(s)
    return print({ dir, bundle: await rt.render(s) })
  }
  if (cmd === "format") {
    const src = pos[0]
    const content = !src || src === "-" ? await readStdin() : await readFile(src, "utf8")
    return print(formatOutput(content, (flag("--profile") ?? "markdown") as any))
  }
  if (cmd === "ingest") {
    const inputFiles = pos
    if (!inputFiles.length) throw new Error("ingest requires at least one file")
    const chunks: string[] = []
    for (const f of inputFiles) {
      chunks.push(`<!-- source: ${f} -->\n\n${await markitdown(f, rt.config.markitdownCommand, rt.config.markitdownMode)}`)
    }
    const content = formatMarkdown(chunks.join("\n\n---\n\n"))
    const save = flag("--save")
    if (save) await rt.storage.savePrompt(save, content, inputFiles.join(","))
    if (has("--stdout") || !save) print(content)
    else print({ saved: save, bytes: Buffer.byteLength(content) })
    return
  }
  if (cmd === "prompt") {
    const action = pos[0], name = pos[1]
    if (action === "list") return print(await rt.storage.listPrompts())
    if (!name) throw new Error("prompt save/load requires NAME")
    if (action === "load") return print(await rt.storage.loadPrompt(name))
    if (action === "save") {
      const src = pos[2]
      const content = !src || src === "-" ? await readStdin() : await readFile(src, "utf8")
      return print(await rt.storage.savePrompt(name, formatMarkdown(content), src ?? "stdin"))
    }
    throw new Error("prompt action must be save|load|list")
  }
  if (cmd === "skills") {
    const action = pos[0]
    if (action === "catalog") {
      const mod = await import("./engine/skills.js")
      return print(mod.CURRENT_SKILL_CATALOG)
    }
    if (action === "route") {
      const task = pos.slice(1).join(" ") || undefined
      const available = flag("--available") ? JSON.parse(flag("--available")!) : undefined
      return print(await rt.skillRoute({ task, explicitSkill: flag("--explicit"), availableIds: available }))
    }
    if (action === "event") {
      const kind = pos[1] as "activate"|"complete"|"fail", id = pos[2]
      if (!["activate","complete","fail"].includes(kind) || !id) throw new Error("skills event requires activate|complete|fail SKILL")
      return print(await rt.skillEvent(kind, id, flag("--reason") ?? "", "CLI_USER"))
    }
    throw new Error("skills action must be catalog|route|event")
  }
  if (cmd === "emit") {
    const state = pos[0] ? await rt.storage.loadRun(pos[0]) : (await rt.state()).state
    const bundle = await rt.render(state)
    return print(bundle.artifact || JSON.stringify(bundle.metadata, null, 2) + "\n")
  }
  if (cmd === "push" || cmd === "pull") {
    const kind = pos[0] as "prompt" | "run", name = pos[1]
    if (!["prompt", "run"].includes(kind) || !name) throw new Error(`${cmd} requires prompt|run NAME`)
    const fn = cmd === "push" ? rt.storage.push.bind(rt.storage) : rt.storage.pull.bind(rt.storage)
    return print(await fn(kind, name, flag("--remote"), has("--overwrite")))
  }
  if (cmd === "opencode") {
    const name = flag("--prompt")
    if (!name) throw new Error("opencode requires --prompt NAME")
    return runOpenCode(await rt.storage.loadPrompt(name))
  }
  throw new Error(`unknown command: ${cmd}`)
}

main().catch(err => {
  process.stderr.write(`dmt: ${err.message}\n`)
  process.exitCode = 1
})
