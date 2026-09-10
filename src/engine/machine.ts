import { randomUUID } from "node:crypto"
import { SerialActor } from "./actor.js"
import { nowIso, sha256, stableJson } from "./util.js"
import type { Candidate, EvidenceItem, LedgerEntry, SkillActivation, STFControl, STFEvent, STFLatent, STFMode, STFPhase, STFRunState, STFStrength } from "./types.js"

export interface BeginInput {
  goal: string
  mode: STFMode
  strength?: STFStrength
  source?: string
  success?: string[]
  anchors?: string[]
  negatives?: string[]
  editMask?: string[]
  guidance?: "low" | "medium" | "high"
  maxCandidates?: number
  maxPasses?: number
  requireCommitApproval?: boolean
}

export interface StatePatch {
  success?: string[]
  facts?: string[]
  assumptions?: string[]
  unknowns?: string[]
  candidates?: Candidate[]
  selected?: string
  evidence?: EvidenceItem[]
  residual?: string[]
  decoded?: string
  formatted?: string
  execution?: string[]
  verification?: string[]
  note?: string
  skill?: { id: string; actor?: string; reason?: string; source?: "native-skill-tool" | "legacy-installed" | "explicit" }
}

function clone<T>(x: T): T { return structuredClone(x) }

function nextPhase(state: STFRunState, event: STFEvent): STFPhase {
  const p = state.phase
  if (event === "ABORT" && !["saved", "aborted"].includes(p)) return "aborted"
  if (event === "PAUSE" && !["idle", "paused", "saved", "aborted"].includes(p)) return "paused"
  if (event === "RESUME" && p === "paused" && state.resumePhase) return state.resumePhase
  if (["SKILL_ACTIVATE", "SKILL_COMPLETE", "SKILL_FAIL"].includes(event)) {
    if (["idle", "saved", "aborted", "paused"].includes(p)) throw new Error(`skill event ${event} not allowed while ${p}`)
    return p
  }
  if (event === "RENOISE" && ["exploring", "grounded", "constrained", "committed"].includes(p)) return "exploring"
  const key = `${p}:${event}`
  const fixed: Record<string, STFPhase> = {
    "idle:START": "captured",
    "captured:ENCODE": "encoded",
    "encoded:EXPLORE": "exploring",
    "exploring:GROUND": "grounded",
    "grounded:CONSTRAIN": "constrained",
    "constrained:COMMIT": "committed",
    "committed:EXECUTE": "executing",
    "executing:VERIFY": "verified",
    "verified:DECODE": "decoded",
    "committed:DECODE": "decoded",
    "decoded:FORMAT": "formatted",
    "formatted:SAVE": "saved"
  }
  const n = fixed[key]
  if (!n) throw new Error(`illegal STF transition ${p} --${event}--> ?`)
  if (p === "committed" && event === "DECODE" && !["plan", "brainstorm"].includes(state.mode)) {
    throw new Error(`${state.mode} mode must EXECUTE and VERIFY before DECODE`)
  }
  if (p === "committed" && event === "EXECUTE" && !["debug", "develop"].includes(state.mode)) {
    throw new Error(`${state.mode} mode decodes from COMMITTED; EXECUTE is reserved for debug/develop`)
  }
  return n
}

export function createIdleRun(): STFRunState {
  const now = nowIso()
  return {
    schema: "g-dmt/state-v1", runId: "idle", goal: "", mode: "plan", phase: "idle",
    logicalClock: 0, version: 0, createdAt: now, updatedAt: now,
    control: {
      strength: "local", editMask: [], anchors: [], negatives: [], guidance: "medium",
      maxCandidates: 3, maxPasses: 4,
      userGate: { requireCommitApproval: false, commitApproved: false }
    },
    latent: { success: [], facts: [], assumptions: [], unknowns: [], candidates: [], evidence: [], residual: [] },
    ledger: [], outputs: {}, skills: { catalog: "user-skills-2026-09-10/f3949bc7", history: [] }
  }
}

export class MachineActor {
  #actor: SerialActor<STFRunState>
  constructor(initial: STFRunState = createIdleRun()) { this.#actor = new SerialActor(clone(initial)) }

  begin(input: BeginInput, actor: "AGENT" | "USER" = "AGENT"): Promise<STFRunState> {
    return this.#actor.ask(state => {
      if (!["idle", "saved", "aborted"].includes(state.phase)) throw new Error(`run ${state.runId} is still ${state.phase}`)
      const now = nowIso()
      const base = createIdleRun()
      Object.assign(state, base, {
        runId: `dmt-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`,
        goal: input.goal.trim(), mode: input.mode, source: input.source, createdAt: now, updatedAt: now
      })
      state.control = {
        strength: input.strength ?? "local",
        editMask: input.editMask ?? [], anchors: input.anchors ?? [], negatives: input.negatives ?? [],
        guidance: input.guidance ?? "medium", maxCandidates: input.maxCandidates ?? 3, maxPasses: input.maxPasses ?? 4,
        userGate: { requireCommitApproval: input.requireCommitApproval ?? false, commitApproved: false }
      }
      state.latent = { success: input.success ?? [], facts: [], assumptions: [], unknowns: [], candidates: [], evidence: [], residual: [] }
      state.skills = { catalog: "user-skills-2026-09-10/f3949bc7", history: [] }
      this.#applyTransition(state, "START", {}, actor)
      return clone(state)
    })
  }

  transition(event: STFEvent, patch: StatePatch = {}, actor: "AGENT" | "USER" | "SYSTEM" = "AGENT"): Promise<STFRunState> {
    return this.#actor.ask(state => {
      if (event === "COMMIT" && state.control.userGate.requireCommitApproval && !state.control.userGate.commitApproved) {
        throw new Error("COMMIT blocked: user approval required. Run `stf approve commit`. Agent tools cannot grant this approval.")
      }
      this.#applyTransition(state, event, patch, actor)
      return clone(state)
    })
  }

  approveCommit(): Promise<STFRunState> {
    return this.#actor.ask(state => {
      if (!state.control.userGate.requireCommitApproval) throw new Error("this run does not require commit approval")
      state.control.userGate.commitApproved = true
      state.control.userGate.approvedAt = nowIso()
      state.control.userGate.approvedBy = "CLI_USER"
      state.version++
      state.updatedAt = nowIso()
      return clone(state)
    })
  }

  /** Adopt a newer canonical disk state. Used to synchronize a long-lived OpenCode plugin with user CLI actions. */
  adopt(external: STFRunState): Promise<STFRunState> {
    return this.#actor.ask(state => {
      const sameRun = state.runId === external.runId
      const maySwitchRun = ["idle", "saved", "aborted"].includes(state.phase)
      if ((sameRun && external.version > state.version) || (!sameRun && maySwitchRun)) {
        Object.assign(state, clone(external))
      }
      return clone(state)
    })
  }

  snapshot(): Promise<STFRunState> { return this.#actor.snapshot(clone) }

  #applyTransition(state: STFRunState, event: STFEvent, patch: StatePatch, actor: "AGENT" | "USER" | "SYSTEM") {
    const from = state.phase
    if (event === "PAUSE") state.resumePhase = from
    const to = nextPhase(state, event)
    if (event === "RESUME") state.resumePhase = undefined

    const l = state.latent
    if (patch.success) l.success = [...patch.success]
    if (patch.facts) l.facts = [...patch.facts]
    if (patch.assumptions) l.assumptions = [...patch.assumptions]
    if (patch.unknowns) l.unknowns = [...patch.unknowns]
    if (patch.candidates) l.candidates = clone(patch.candidates).slice(0, state.control.maxCandidates)
    if (patch.selected !== undefined) l.selected = patch.selected
    if (patch.evidence) l.evidence = clone(patch.evidence)
    if (patch.residual) l.residual = [...patch.residual]
    if (patch.decoded !== undefined) l.decoded = patch.decoded
    if (patch.formatted !== undefined) l.formatted = patch.formatted
    if (patch.execution) l.execution = [...patch.execution]
    if (patch.verification) l.verification = [...patch.verification]

    if (event === "COMMIT" && !l.selected && state.mode !== "debug") throw new Error("COMMIT requires latent.selected")
    if (event === "GROUND" && l.evidence.length === 0 && state.mode !== "brainstorm") throw new Error("GROUND requires at least one evidence item outside brainstorm mode")
    if (event === "DECODE" && !l.decoded) throw new Error("DECODE requires patch.decoded")
    if (event === "FORMAT" && !l.formatted) throw new Error("FORMAT requires patch.formatted")

    if (event === "SKILL_ACTIVATE") {
      if (!patch.skill?.id) throw new Error("SKILL_ACTIVATE requires patch.skill.id")
      if (state.skills.active) throw new Error(`skill ${state.skills.active.id} is already active; complete/fail it before activating another`)
      state.skills.active = {
        id: patch.skill.id,
        actor: patch.skill.actor ?? "SkillRouterActor",
        phase: state.phase,
        reason: patch.skill.reason ?? "routed for current task",
        source: patch.skill.source ?? "native-skill-tool",
        startedAt: nowIso(),
        logicalClock: state.logicalClock + 1
      }
    }
    if (event === "SKILL_COMPLETE" || event === "SKILL_FAIL") {
      const active = state.skills.active
      if (!active) throw new Error(`${event} requires an active skill`)
      if (patch.skill?.id && patch.skill.id !== active.id) throw new Error(`${event} id ${patch.skill.id} does not match active skill ${active.id}`)
      state.skills.history.push({ ...active, status: event === "SKILL_COMPLETE" ? "completed" : "failed", endedAt: nowIso(), note: patch.note })
      state.skills.active = undefined
    }

    state.phase = to
    state.logicalClock++
    state.version++
    state.updatedAt = nowIso()
    const prev = state.ledger.at(-1)?.hash ?? "GENESIS"
    const material = { seq: state.ledger.length + 1, logicalClock: state.logicalClock, actor, event, from, to, note: patch.note ?? "", previousHash: prev }
    const entry: LedgerEntry = { ...material, at: state.updatedAt, hash: sha256(stableJson(material)) }
    state.ledger.push(entry)
  }
}

export function phaseAllowsMutation(state: STFRunState): boolean {
  if (["paused", "aborted", "idle", "captured", "encoded", "exploring", "grounded", "constrained"].includes(state.phase)) return false
  return ["committed", "executing", "verified", "decoded", "formatted", "saved"].includes(state.phase)
}

export function nextContract(state: STFRunState): string {
  const skill = state.skills?.active ? ` | skill=${state.skills.active.id}` : ""
  const prefix = `Goblin-D.M.T. ${state.runId} | ${state.mode} | phase=${state.phase} | clock=${state.logicalClock}${skill}`
  const residual = state.latent.residual.length ? ` Residual: ${state.latent.residual.join("; ")}` : ""
  const map: Partial<Record<STFPhase, string>> = {
    captured: "ENCODE: compress the request into success/facts/assumptions/unknowns. Do not solve yet.",
    encoded: "EXPLORE: create only materially distinct candidates justified by real ambiguity; candidates are a ceiling, not a quota.",
    exploring: "GROUND: acquire evidence that separates candidates or resolves an unknown. Rephrasing is not evidence.",
    grounded: "CONSTRAIN: reject candidates violating anchors, negatives, edit mask, or verified evidence.",
    constrained: state.control.userGate.requireCommitApproval && !state.control.userGate.commitApproved
      ? "WAIT FOR USER COMMIT APPROVAL, then COMMIT the selected candidate."
      : "COMMIT: select the smallest evidence-supported direction and freeze its change envelope.",
    committed: ["debug", "develop"].includes(state.mode)
      ? "EXECUTE inside the edit mask/change envelope; do not silently widen scope."
      : "DECODE the committed latent into the requested plan/brainstorm artifact.",
    executing: "VERIFY with concrete tests/checks; record results, not confidence theater.",
    verified: "DECODE the verified result into a concise handoff/artifact.",
    decoded: "FORMAT the decoded artifact canonically; preserve semantics.",
    formatted: "SAVE a checkpoint/artifact. Remote PUSH remains user-controlled unless explicitly enabled.",
    saved: "Run complete. Start a new run only if the goal/material evidence changed.",
    paused: "Run paused. Do not mutate project state until RESUME.",
    aborted: "Run aborted. Do not continue it."
  }
  return `${prefix}
${map[state.phase] ?? "No next contract."}${residual}`
}
