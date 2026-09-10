import path from "node:path"
import { tool } from "@opencode-ai/plugin"
import { Plugin } from "@opencode/plugin"
import { StableTextFusionRuntime } from "./engine/runtime.js"
import { phaseAllowsMutation } from "./engine/machine.js"
import { globMatch } from "./engine/util.js"
import type { STFEvent, STFMode, STFStrength } from "./engine/types.js"

function parseJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch (e: any) { throw new Error(`invalid JSON: ${e.message}`) }
}

function rootFromV1(ctx: any): string {
  return path.resolve(ctx?.worktree || ctx?.directory || process.cwd())
}
function rootFromV2(ctx: any): string {
  return path.resolve(ctx?.location?.directory || process.cwd())
}

function extractMutationPaths(args: any): string[] {
  const found = new Set<string>()
  for (const key of ["filePath", "path", "file_path"]) {
    if (typeof args?.[key] === "string" && args[key].trim()) found.add(args[key].trim())
  }
  if (typeof args?.patchText === "string") {
    const re = /^\*\*\*\s+(?:Add|Update|Delete) File:\s+(.+?)\s*$/gm
    for (const match of args.patchText.matchAll(re)) found.add(match[1])
    const move = /^\*\*\*\s+Move to:\s+(.+?)\s*$/gm
    for (const match of args.patchText.matchAll(move)) found.add(match[1])
  }
  return [...found]
}

async function assertMutationAllowed(runtime: StableTextFusionRuntime, root: string, toolName: string, args: any) {
  if (!runtime.config.strictPhaseGate) return
  if (!runtime.config.mutationTools.includes(toolName)) return
  const state = (await runtime.state()).state
  if (!phaseAllowsMutation(state)) {
    throw new Error(`DMT phase gate: tool '${toolName}' blocked while run ${state.runId} is ${state.phase}. Commit a bounded plan first.`)
  }
  if (!state.control.editMask.length) return
  const paths = extractMutationPaths(args)
  if (!paths.length) {
    throw new Error(`DMT edit-mask gate: '${toolName}' did not expose a target path; refusing masked mutation fail-closed`)
  }
  for (const filePath of paths) {
    const rel = path.relative(root, path.resolve(root, filePath)).replace(/\\/g, "/")
    if (rel.startsWith("../") || path.isAbsolute(rel) || !state.control.editMask.some((p: string) => globMatch(p, rel))) {
      throw new Error(`DMT edit-mask gate: '${rel}' is outside [${state.control.editMask.join(", ")}]`)
    }
  }
}

function checkpointText(state: any, engine_prompt: string): string {
  return `## Goblin-D.M.T. engine checkpoint\nRun: ${state.runId}\nMode: ${state.mode}\nPhase: ${state.phase}\nClock: ${state.logicalClock}\nGoal: ${state.goal}\nSelected: ${state.latent.selected ?? "none"}\nResidual: ${state.latent.residual.join("; ") || "none"}\nEdit mask: ${state.control.editMask.join(", ") || "none"}\nActive skill: ${state.skills?.active?.id ?? "none"}\nNext contract:\n${engine_prompt}`
}

async function createV1Hooks(ctx: any): Promise<any> {
  const root = rootFromV1(ctx)
  const runtime = await StableTextFusionRuntime.create(root)
  return {
    tool: {
      dmt_begin: tool({
        description: "Start an engine-state-bound Goblin-D.M.T. run. Agent can run phases; user-owned gates remain outside agent control.",
        args: {
          goal: tool.schema.string(), mode: tool.schema.string(), strength: tool.schema.string().optional(),
          source: tool.schema.string().optional(), success_json: tool.schema.string().optional(),
          anchors_json: tool.schema.string().optional(), negatives_json: tool.schema.string().optional(), edit_mask_json: tool.schema.string().optional()
        },
        async execute(args: any) {
          return JSON.stringify(await runtime.begin({
            goal: args.goal, mode: args.mode as STFMode, strength: args.strength as STFStrength | undefined,
            source: args.source, success: parseJson(args.success_json, []), anchors: parseJson(args.anchors_json, []),
            negatives: parseJson(args.negatives_json, []), editMask: parseJson(args.edit_mask_json, [])
          }), null, 2)
        }
      }),
      dmt_state: tool({ description: "Read the current Goblin-D.M.T. engine state and next phase contract.", args: {}, async execute() { return JSON.stringify(await runtime.state(), null, 2) } }),
      dmt_transition: tool({
        description: "Advance one legal Goblin-D.M.T. event with a structured state patch. Illegal or user-gated transitions are rejected.",
        args: { event: tool.schema.string(), patch_json: tool.schema.string().optional() },
        async execute(args: any) { return JSON.stringify(await runtime.transition(args.event as STFEvent, parseJson(args.patch_json, {}), "AGENT"), null, 2) }
      }),
      dmt_checkpoint: tool({
        description: "Persist the current run locally and return its output-driven artifact+metadata bundle.", args: {},
        async execute() { const state = (await runtime.state()).state; const dir = await runtime.storage.saveState(state); return JSON.stringify({ dir, bundle: await runtime.render(state), engine_prompt: (await runtime.state()).engine_prompt }, null, 2) }
      }),
      dmt_format: tool({ description: "Canonicalize a decoded prompt/handoff without changing semantics.", args: { content: tool.schema.string(), profile: tool.schema.string().optional() }, async execute(args: any) { return runtime.format(args.content, args.profile ?? "markdown") } }),
      dmt_prompt_store: tool({
        description: "Save/load/list reusable prompt artifacts in the configured local Goblin-D.M.T. prompt store.",
        args: { action: tool.schema.string(), name: tool.schema.string().optional(), content: tool.schema.string().optional() },
        async execute(args: any) {
          if (args.action === "save") { if (!runtime.config.agentCanSave) throw new Error("agent prompt saving disabled by user config"); if (!args.name || args.content === undefined) throw new Error("save requires name and content"); return JSON.stringify(await runtime.storage.savePrompt(args.name, args.content, "opencode-agent"), null, 2) }
          if (args.action === "load") { if (!args.name) throw new Error("load requires name"); return runtime.storage.loadPrompt(args.name) }
          if (args.action === "list") return JSON.stringify(await runtime.storage.listPrompts(), null, 2)
          throw new Error("action must be save|load|list")
        }
      }),
      dmt_skill_route: tool({
        description: "Route the current Goblin-D.M.T. phase to the smallest appropriate installed user skill. Returns when/where/how/stop guidance; does not load the skill body.",
        args: { task: tool.schema.string().optional(), explicit_skill: tool.schema.string().optional(), available_json: tool.schema.string().optional() },
        async execute(args: any) { return JSON.stringify(await runtime.skillRoute({ task: args.task, explicitSkill: args.explicit_skill, availableIds: parseJson(args.available_json, undefined as any) }), null, 2) }
      }),
      dmt_skill_event: tool({
        description: "Record activation/completion/failure of one OpenCode-native skill in canonical Goblin-D.M.T. engine state.",
        args: { action: tool.schema.string(), id: tool.schema.string(), reason: tool.schema.string().optional(), actor: tool.schema.string().optional() },
        async execute(args: any) { if(!["activate","complete","fail"].includes(args.action)) throw new Error("action must be activate|complete|fail"); return JSON.stringify(await runtime.skillEvent(args.action, args.id, args.reason ?? "", args.actor ?? "SkillRouterActor"), null, 2) }
      }),
      dmt_sync: tool({
        description: "Push/pull a Goblin-D.M.T. prompt or run to a configured directory remote. Disabled for agents by default; CLI remains user-controlled.",
        args: { action: tool.schema.string(), kind: tool.schema.string(), name: tool.schema.string(), remote: tool.schema.string().optional() },
        async execute(args: any) {
          if (!runtime.config.agentCanSync) throw new Error("agent sync disabled by user config; use explicit `stf push`/`stf pull` or enable agentCanSync")
          if (args.action === "push") return runtime.storage.push(args.kind, args.name, args.remote)
          if (args.action === "pull") return runtime.storage.pull(args.kind, args.name, args.remote)
          throw new Error("action must be push|pull")
        }
      })
    },
    "tool.execute.before": async (input: any, output: any) => assertMutationAllowed(runtime, root, input.tool, output?.args),
    "experimental.session.compacting": async (_input: any, output: any) => {
      const { state, engine_prompt } = await runtime.state()
      if (["idle", "saved", "aborted"].includes(state.phase)) return
      output.context.push(`\n${checkpointText(state, engine_prompt)}\n`)
    },
    event: async ({ event }: any) => {
      if (event?.type === "session.idle" && runtime.config.autoCheckpoint) {
        const state = (await runtime.state()).state
        if (!["idle", "aborted"].includes(state.phase)) await runtime.storage.saveState(state)
      }
    }
  }
}

const stringProp = { type: "string" } as const
function objectSchema(properties: Record<string, any>, required: string[] = []) {
  return { type: "object", properties, required, additionalProperties: false }
}
function v2Text(content: unknown) { return { content: typeof content === "string" ? content : JSON.stringify(content, null, 2) } }

async function setupV2(ctx: any): Promise<void> {
  const root = rootFromV2(ctx)
  const runtime = await StableTextFusionRuntime.create(root)
  await ctx.tool.transform((editor: any) => {
    editor.add({ name: "dmt_begin", description: "Start an engine-state-bound Goblin-D.M.T. run.", input: objectSchema({ goal:stringProp, mode:stringProp, strength:stringProp, source:stringProp, success_json:stringProp, anchors_json:stringProp, negatives_json:stringProp, edit_mask_json:stringProp }, ["goal","mode"]), execute: async (input:any) => v2Text(await runtime.begin({ goal:input.goal, mode:input.mode as STFMode, strength:input.strength as STFStrength|undefined, source:input.source, success:parseJson(input.success_json,[]), anchors:parseJson(input.anchors_json,[]), negatives:parseJson(input.negatives_json,[]), editMask:parseJson(input.edit_mask_json,[]) })) })
    editor.add({ name: "dmt_state", description: "Read current Goblin-D.M.T. engine state.", input: objectSchema({}), execute: async () => v2Text(await runtime.state()) })
    editor.add({ name: "dmt_transition", description: "Advance one legal Goblin-D.M.T. state transition.", input: objectSchema({event:stringProp,patch_json:stringProp},["event"]), execute: async (input:any) => v2Text(await runtime.transition(input.event as STFEvent, parseJson(input.patch_json,{}), "AGENT")) })
    editor.add({ name: "dmt_checkpoint", description: "Persist and render the current Goblin-D.M.T. checkpoint.", input: objectSchema({}), execute: async () => { const state=(await runtime.state()).state; return v2Text({dir:await runtime.storage.saveState(state),bundle:await runtime.render(state)}) } })
    editor.add({ name: "dmt_format", description: "Canonicalize a Goblin-D.M.T. artifact.", input: objectSchema({content:stringProp,profile:stringProp},["content"]), execute: async (input:any) => v2Text(await runtime.format(input.content,input.profile??"markdown")) })
    editor.add({ name: "dmt_prompt_store", description: "Save/load/list Goblin-D.M.T. prompt artifacts.", input: objectSchema({action:stringProp,name:stringProp,content:stringProp},["action"]), execute: async (input:any) => { if(input.action==="save"){if(!runtime.config.agentCanSave)throw new Error("agent prompt saving disabled by user config");if(!input.name||input.content===undefined)throw new Error("save requires name and content");return v2Text(await runtime.storage.savePrompt(input.name,input.content,"opencode-agent"))} if(input.action==="load"){if(!input.name)throw new Error("load requires name");return v2Text(await runtime.storage.loadPrompt(input.name))} if(input.action==="list")return v2Text(await runtime.storage.listPrompts()); throw new Error("action must be save|load|list") } })
    editor.add({ name: "dmt_skill_route", description: "Route current Goblin-D.M.T. work to the smallest appropriate installed skill.", input: objectSchema({task:stringProp,explicit_skill:stringProp}), execute: async (input:any) => { let ids:string[]|undefined; try { const listed=await ctx.skill.list(); ids=(listed?.data ?? listed ?? []).map((x:any)=>x.id ?? x.name).filter(Boolean) } catch {} return v2Text(await runtime.skillRoute({task:input.task,explicitSkill:input.explicit_skill,availableIds:ids})) } })
    editor.add({ name: "dmt_skill_event", description: "Record one skill activation/completion/failure in canonical engine state.", input: objectSchema({action:stringProp,id:stringProp,reason:stringProp,actor:stringProp},["action","id"]), execute: async (input:any) => { if(!["activate","complete","fail"].includes(input.action)) throw new Error("action must be activate|complete|fail"); return v2Text(await runtime.skillEvent(input.action,input.id,input.reason??"",input.actor??"SkillRouterActor")) } })
    editor.add({ name: "dmt_sync", description: "User-configurable Goblin-D.M.T. remote sync; denied to agents by default.", input: objectSchema({action:stringProp,kind:stringProp,name:stringProp,remote:stringProp},["action","kind","name"]), execute: async (input:any) => { if(!runtime.config.agentCanSync)throw new Error("agent sync disabled by user config; use explicit CLI sync"); if(input.action==="push")return v2Text(await runtime.storage.push(input.kind,input.name,input.remote)); if(input.action==="pull")return v2Text(await runtime.storage.pull(input.kind,input.name,input.remote)); throw new Error("action must be push|pull") } })
  })
  await ctx.tool.hook("execute.before", async (event: any) => assertMutationAllowed(runtime, root, event.tool, event.input))
  const reinforce = async (event: any) => {
    const { state, engine_prompt } = await runtime.state()
    if (["idle", "saved", "aborted"].includes(state.phase)) return
    event.system.push({ text: checkpointText(state, engine_prompt) })
  }
  await ctx.session.hook("context", reinforce)
  await ctx.session.hook("compaction", reinforce)
}

/** OpenCode stable 1.18.29+ dual-host entrypoint: V1 calls server(ctx); V2 reads id/setup. */
export const server = createV1Hooks
export const GoblinDMTPlugin = createV1Hooks
export const id = "dmt"
export const setup = setupV2

export default {
  ...Plugin.define({ id, setup }),
  server
}
