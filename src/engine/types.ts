export type STFMode = "plan" | "debug" | "brainstorm" | "develop"
export type STFStrength = "surface" | "local" | "module" | "rewrite"
export type STFPhase =
  | "idle" | "captured" | "encoded" | "exploring" | "grounded" | "constrained"
  | "committed" | "executing" | "verified" | "decoded" | "formatted" | "saved"
  | "paused" | "aborted"

export type STFEvent =
  | "START" | "ENCODE" | "EXPLORE" | "GROUND" | "CONSTRAIN" | "COMMIT"
  | "EXECUTE" | "VERIFY" | "DECODE" | "FORMAT" | "SAVE" | "RENOISE"
  | "PAUSE" | "RESUME" | "ABORT" | "SKILL_ACTIVATE" | "SKILL_COMPLETE" | "SKILL_FAIL"

export interface EvidenceItem {
  id?: string
  kind: "file" | "test" | "log" | "command" | "user" | "web" | "other"
  source: string
  claim: string
  result?: string
}

export interface Candidate {
  id: string
  summary: string
  status?: "live" | "rejected" | "selected"
  rejectReason?: string
  evidence?: string[]
}

export interface UserGate {
  requireCommitApproval: boolean
  commitApproved: boolean
  approvedAt?: string
  approvedBy?: "CLI_USER"
}

export interface STFControl {
  strength: STFStrength
  editMask: string[]
  anchors: string[]
  negatives: string[]
  guidance: "low" | "medium" | "high"
  maxCandidates: number
  maxPasses: number
  userGate: UserGate
}

export interface STFLatent {
  success: string[]
  facts: string[]
  assumptions: string[]
  unknowns: string[]
  candidates: Candidate[]
  selected?: string
  evidence: EvidenceItem[]
  residual: string[]
  decoded?: string
  formatted?: string
  execution?: string[]
  verification?: string[]
}


export interface SkillActivation {
  id: string
  actor: string
  phase: STFPhase
  reason: string
  source: "native-skill-tool" | "legacy-installed" | "explicit"
  startedAt: string
  logicalClock: number
}

export interface SkillHistoryEntry extends SkillActivation {
  status: "completed" | "failed"
  endedAt: string
  note?: string
}

export interface SkillRuntimeState {
  catalog: string
  active?: SkillActivation
  history: SkillHistoryEntry[]
}

export interface LedgerEntry {
  seq: number
  logicalClock: number
  at: string
  actor: "AGENT" | "USER" | "SYSTEM"
  event: STFEvent
  from: STFPhase
  to: STFPhase
  note?: string
  previousHash: string
  hash: string
}

export interface STFRunState {
  schema: "g-dmt/state-v1"
  runId: string
  goal: string
  mode: STFMode
  phase: STFPhase
  resumePhase?: STFPhase
  logicalClock: number
  version: number
  createdAt: string
  updatedAt: string
  source?: string
  control: STFControl
  latent: STFLatent
  ledger: LedgerEntry[]
  outputs: Record<string, string>
  skills: SkillRuntimeState
}

export interface STFConfig {
  stateDir: string
  strictPhaseGate: boolean
  mutationTools: string[]
  agentCanSave: boolean
  agentCanSync: boolean
  autoCheckpoint: boolean
  markitdownCommand: string
  markitdownMode: "go" | "stdout"
  remoteDir?: string
  requireCommitApproval: boolean
  skillRoutingEnabled: boolean
  skillCatalog: string
}

export const DEFAULT_CONFIG: STFConfig = {
  stateDir: ".g-dmt",
  strictPhaseGate: true,
  mutationTools: ["edit", "write", "apply_patch", "patch"],
  agentCanSave: true,
  agentCanSync: false,
  autoCheckpoint: true,
  markitdownCommand: "markitdown",
  markitdownMode: "go",
  requireCommitApproval: false,
  skillRoutingEnabled: true,
  skillCatalog: "user-skills-2026-09-10/f3949bc7"
}
