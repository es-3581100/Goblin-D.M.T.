import path from "node:path"
import { readFile } from "node:fs/promises"
import { MachineActor, createIdleRun, nextContract } from "./machine.js"
import { StorageActor } from "./storage.js"
import { loadConfig } from "./config.js"
import { formatOutput, type FormatProfile } from "./format.js"
import { LazyGraph } from "./graph.js"
import type { BeginInput, StatePatch } from "./machine.js"
import { routeSkills, type SkillRouteInput } from "./skills.js"
import { assertLedgerConsistency } from "./ledger-consistency.js"
import type { STFConfig, STFEvent, STFRunState } from "./types.js"

export class StableTextFusionRuntime {
  readonly root: string
  readonly config: STFConfig
  readonly storage: StorageActor
  readonly machine: MachineActor

  private constructor(root: string, config: STFConfig, initial?: STFRunState) {
    this.root = root
    this.config = config
    this.storage = new StorageActor(root, config)
    this.machine = new MachineActor(initial ?? createIdleRun())
  }

  static async create(root: string): Promise<StableTextFusionRuntime> {
    const config = await loadConfig(root)
    const storage = new StorageActor(root, config)
    const initial = await storage.loadCurrent()
    const rt = new StableTextFusionRuntime(root, config, initial)
    await rt.storage.init()
    return rt
  }

  private async refreshFromDisk(): Promise<void> {
    const external = await this.storage.loadCurrent()
    if (external) await this.machine.adopt(external)
  }

  async begin(input: BeginInput, actor: "AGENT" | "USER" = "AGENT") {
    return this.storage.withStateLock(async () => {
      await this.refreshFromDisk()
      input.requireCommitApproval ??= this.config.requireCommitApproval
      const state = await this.machine.begin(input, actor)
      await this.storage.saveState(state)
      return this.envelope(state)
    })
  }

  async transition(event: STFEvent, patch: StatePatch = {}, actor: "AGENT" | "USER" | "SYSTEM" = "AGENT") {
    return this.storage.withStateLock(async () => {
      await this.refreshFromDisk()
      if (event === "FORMAT" && !patch.formatted) {
        const current = await this.machine.snapshot()
        const decoded = patch.decoded ?? current.latent.decoded
        if (decoded) patch.formatted = formatOutput(decoded, "markdown")
      }

      // Build-ledger bookkeeping is mechanically checked before it can advance
      // through FORMAT or SAVE. The gate is narrow: ordinary artifacts are ignored.
      // A mismatch must repair the summary, never the evidence rows.
      if (event === "FORMAT" && patch.formatted) {
        assertLedgerConsistency(patch.formatted)
      }
      if (event === "SAVE") {
        const current = await this.machine.snapshot()
        const artifact = patch.formatted ?? current.latent.formatted ?? current.latent.decoded
        if (artifact) assertLedgerConsistency(artifact)
      }

      const state = await this.machine.transition(event, patch, actor)
      await this.storage.saveState(state)
      return this.envelope(state)
    })
  }

  async state() {
    return this.storage.withStateLock(async () => {
      await this.refreshFromDisk()
      return this.envelope(await this.machine.snapshot())
    })
  }

  async approveCommit() {
    return this.storage.withStateLock(async () => {
      await this.refreshFromDisk()
      const state = await this.machine.approveCommit()
      await this.storage.saveState(state)
      return this.envelope(state)
    })
  }


  async skillRoute(input: SkillRouteInput = {}) {
    const current = (await this.state()).state
    if (!this.config.skillRoutingEnabled) return { actor: "SkillRouterActor", phase: current.phase, mode: current.mode, task: input.task ?? current.goal, alternates: [], instruction: "Skill routing is disabled by user config.", catalog: this.config.skillCatalog }
    return routeSkills(current, input)
  }

  async skillEvent(action: "activate" | "complete" | "fail", id: string, reason = "", actor = "SkillRouterActor") {
    const event: STFEvent = action === "activate" ? "SKILL_ACTIVATE" : action === "complete" ? "SKILL_COMPLETE" : "SKILL_FAIL"
    return this.transition(event, { skill: { id, actor, reason, source: "native-skill-tool" }, note: reason }, "AGENT")
  }

  async format(content: string, profile: FormatProfile = "markdown") { return formatOutput(content, profile) }

  async render(run?: STFRunState): Promise<{artifact: string, metadata: unknown}> {
    const current = run ?? await this.machine.snapshot()
    const graph = new LazyGraph<STFRunState>([
      { id: "state", run: (_d, s) => s },
      { id: "artifact", deps: ["state"], run: (_d, s) => s.latent.formatted ?? s.latent.decoded ?? "" },
      { id: "metadata", deps: ["state"], run: (_d, s) => ({ runId: s.runId, phase: s.phase, clock: s.logicalClock, mode: s.mode, residual: s.latent.residual, evidenceCount: s.latent.evidence.length, ledgerHash: s.ledger.at(-1)?.hash ?? "GENESIS", activeSkill: s.skills?.active?.id ?? null, skillHistoryCount: s.skills?.history?.length ?? 0 }) },
      { id: "bundle", deps: ["artifact", "metadata"], run: d => ({ artifact: d.artifact as string, metadata: d.metadata }) }
    ])
    return await graph.render("bundle", current) as any
  }

  envelope(state: STFRunState) {
    return { state, engine_prompt: nextContract(state) }
  }
}
