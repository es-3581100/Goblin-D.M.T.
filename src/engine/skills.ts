import type { STFMode, STFPhase, STFRunState } from "./types.js"

export type SkillLoadPolicy = "auto-eligible" | "explicit-only" | "installed-only" | "legacy-readonly"
export type SkillEffect = "computes" | "reads" | "decides" | "transacts" | "suspends" | "no-rollback"

export interface SkillDescriptor {
  id: string
  actor: string
  phases: STFPhase[]
  modes?: STFMode[]
  effects: SkillEffect[]
  loadPolicy: SkillLoadPolicy
  keywords: string[]
  when: string
  where: string
  how: string
  stop: string
  notes?: string
}

export interface SkillRouteInput {
  task?: string
  explicitSkill?: string
  availableIds?: string[]
  limit?: number
}

export interface SkillRouteCandidate {
  id: string
  score: number
  actor: string
  effects: SkillEffect[]
  when: string
  where: string
  how: string
  stop: string
  available: boolean | "unknown"
  loadPolicy: SkillLoadPolicy
  reason: string[]
  notes?: string
}

export interface SkillRouteResult {
  actor: "SkillRouterActor"
  phase: STFPhase
  mode: STFMode
  task: string
  primary?: SkillRouteCandidate
  alternates: SkillRouteCandidate[]
  instruction: string
  catalog: string
}

const P = (xs: STFPhase[]) => xs
const M = (xs: STFMode[]) => xs

/**
 * Curated from the user's 2026-09-10 skill pack. This is routing metadata only.
 * Skill bodies remain OpenCode-native and are loaded on demand with the native skill tool.
 */
export const CURRENT_SKILL_CATALOG: SkillDescriptor[] = [
  {
    id: "workspace-snapshot", actor: "SnapshotActor", phases: P(["captured","encoded","exploring","grounded","constrained"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads","decides"], loadPolicy: "auto-eligible",
    keywords: ["snapshot","workspace","zip","archive","handoff","drift","resume","content-addressed","snapshot id"],
    when: "A stable, content-addressed source view is needed for a ZIP, Git worktree, directory, file, handoff, resume, or drift comparison.",
    where: "CAPTURE/CONDITION/GROUND before broad repo work; especially at model handoff or when the target arrives as an archive.",
    how: "Load the skill, use its deterministic helper and validation receipt, record snapshot/source IDs as evidence, and do not execute target code merely to snapshot it.",
    stop: "Stop when identity_complete is established or the skill reports PARTIAL/BLOCKED; do not turn snapshotting into dependency resolution or execution."
  },
  {
    id: "zero-review-graph", actor: "GraphEvidenceActor", phases: P(["exploring","grounded","constrained","verified"]),
    modes: M(["debug","develop","plan"]), effects: ["reads","decides"], loadPolicy: "auto-eligible",
    keywords: ["go","rust","zerolang","zero.graph","graph review","blast radius","impact","reverse dependency","review","debug"],
    when: "Reviewing/debugging Go, Rust, or ZeroLang where graph-first retrieval and blast-radius analysis can reduce broad source reads.",
    where: "GROUND before opening many dependents; VERIFY when impact evidence is needed.",
    how: "Build/refresh the graph when stale, use graph_search/impact_analyze/context_pack, then read the bounded context set; treat graph edges as retrieval evidence, not correctness proof.",
    stop: "Stop after evidence, blast radius, tests-to-run, and unresolved graph limitations are recorded."
  },
  {
    id: "prompt-dev-formalization", actor: "FormalizationActor", phases: P(["captured","encoded","exploring","grounded","constrained","decoded"]),
    modes: M(["plan","develop","brainstorm"]), effects: ["reads","decides","computes"], loadPolicy: "auto-eligible",
    keywords: ["formalize","one-shot prompt","development prompt","mmdp","requirements","state packet","prompt dev","build prompt"],
    when: "Loosely specified development work needs to become a provenance-preserving one-shot development prompt or the user explicitly requests formalization.",
    where: "CONDITION through CONSTRAIN; DECODE when the requested artifact is the formalized prompt itself.",
    how: "Preserve literal requirements and provenance, separate MUST/SHOULD/MAY, resolve or explicitly retain unknowns, and satisfy the skill's terminal-artifact contract without inventing missing facts.",
    stop: "Stop on the skill's PASS/PARTIAL/FAIL completion semantics; do not let format compliance override truth or safety."
  },
  {
    id: "research-module", actor: "ResearchCorpusActor", phases: P(["encoded","exploring","grounded","constrained","saved"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads","decides","transacts"], loadPolicy: "explicit-only",
    keywords: ["research module","research corpus","archive research","module corpus","research-module"],
    when: "The user explicitly wants a bounded, durable research corpus/module, or project instructions require one.",
    where: "GROUND for corpus acquisition/validation; SAVE for admitted module state.",
    how: "Follow C0→C4 source precedence, keep YAML/JSON paired metadata consistent, distinguish stored/retrieved/validated/active, and mutate only the named module/registry scope.",
    stop: "Stop at the requested module operation and acceptance state; never broaden into unrelated filesystem/network/credential exploration."
  },
  {
    id: "go-wiki-memory", actor: "ReadOnlyMemoryActor", phases: P(["captured","encoded","exploring","grounded"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads"], loadPolicy: "auto-eligible",
    keywords: ["go-wiki","go wiki","/memory","/search","/ask","shared memory","memory context"],
    when: "The task/project explicitly references Go-Wiki memory or a bounded read-only memory lookup would resolve context already known to exist.",
    where: "CAPTURE/GROUND/RESUME as optional read-only context, never as project authority.",
    how: "Use existing localhost/CLI read surfaces only, treat retrieval as non-authoritative context, and admit conclusions only through repository evidence/project governance.",
    stop: "If unavailable, record that and continue from local evidence; do not install/start services or inspect credentials merely to retrieve memory."
  },
  {
    id: "dynamic-build-ledger", actor: "LedgerActor", phases: P(["captured","encoded","grounded","constrained","committed","executing","verified","decoded","formatted","saved"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads","decides","transacts"], loadPolicy: "installed-only",
    keywords: ["dynamic build ledger","build ledger","ledger","project governance","durable governance","authorization"],
    when: "A Dynamic Build Ledger already governs the project, or the user explicitly asks to initialize/use one.",
    where: "Across the run for governed projects; SAVE/VERIFY for durable evidence and current projections.",
    how: "Respect repository truth above ledger prose, preserve immutable/current separation, and on first initialization obey the skill's exact standalone `666` authorization gate before creating ledger files.",
    stop: "Stop before first initialization without exact authorization; otherwise update only within the approved ledger envelope.",
    notes: "Do not auto-initialize just because D.M.T. can see this skill."
  },
  {
    id: "update-ledger-compact", actor: "CompactionLedgerActor", phases: P(["grounded","constrained","committed","executing","verified","decoded","formatted"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads","decides","transacts","suspends"], loadPolicy: "installed-only",
    keywords: ["compact","compaction","context reset","model handoff","ledger checkpoint","closeout","memory closeout"],
    when: "Context compaction/model handoff is approaching AND an initialized Dynamic Build Ledger exists with mutation authority.",
    where: "Immediately before OpenCode compaction; then reground after compaction.",
    how: "Persist project-state and checkpoint first, invoke only the supported normal compaction mechanism, then reload from disk and verify the closeout/capsule references.",
    stop: "Do not fabricate a ledger when absent and do not emulate compaction by changing OpenCode config/plugins/services."
  },
  {
    id: "make-an-opencode-plugin", actor: "ExtensionBuilderActor", phases: P(["encoded","exploring","grounded","constrained","committed","executing","verified"]),
    modes: M(["plan","debug","develop"]), effects: ["reads","decides","transacts","suspends"], loadPolicy: "auto-eligible",
    keywords: ["opencode plugin","plugin","custom tool","hook","extension","@opencode/plugin","@opencode-ai/plugin","server(ctx)","setup(ctx)"],
    when: "Designing, building, repairing, auditing, or converting an OpenCode extension/plugin/custom tool.",
    where: "CONDITION/GROUND to choose the least-complex extension type; EXECUTE/VERIFY for implementation and host-contract checks.",
    how: "Load current OpenCode contracts, choose skill vs custom tool vs plugin intentionally, preserve host-version compatibility, scaffold minimally, and verify registration plus failure paths.",
    stop: "Stop after the chosen extension type is implemented/verified; do not escalate a simple skill into a plugin without need."
  },
  {
    id: "make-an-opencode-skill", actor: "SkillBuilderActor", phases: P(["encoded","grounded","constrained","committed","executing","verified","decoded"]),
    modes: M(["plan","develop","debug"]), effects: ["reads","decides","transacts","suspends"], loadPolicy: "auto-eligible",
    keywords: ["opencode skill","skill.md","agent skill","make skill","repair skill","audit skill","skill frontmatter"],
    when: "Creating, repairing, auditing, validating, or improving an OpenCode skill.",
    where: "CONDITION/GROUND for contract/version discovery; EXECUTE/VERIFY for scaffold and validation.",
    how: "Use the version-aware canonical OpenCode contract, preserve supporting files, validate ID/frontmatter/discovery, and prefer deterministic scaffolding over hand-wavy instructions.",
    stop: "Stop once discovery/loading/validation are proven or a concrete incompatibility is reported."
  },
  {
    id: "make-a-new-local-repo", actor: "RepositoryBootstrapActor", phases: P(["constrained","committed","executing","verified","saved"]),
    modes: M(["plan","develop"]), effects: ["reads","decides","transacts","no-rollback"], loadPolicy: "installed-only",
    keywords: ["new local repo","new repo","bootstrap repo","adopt github repo","git repository","repo setup","github remote"],
    when: "The user explicitly wants a new canonical local repository or adoption of a newly-created GitHub repository.",
    where: "After scope/ownership is established; EXECUTE for local bootstrap, user-gated for external remote/push effects.",
    how: "Follow the skill's source-adoption and Git identity checks, keep local creation separate from external publication, and require explicit authority for push/remote side effects.",
    stop: "Stop before unapproved external publication or when repo identity/ownership cannot be proven."
  },
  {
    id: "local-ai-runtime-optimizer", actor: "RuntimeOptimizerActor", phases: P(["captured","encoded","grounded","constrained","committed","executing","verified"]),
    modes: M(["plan","debug","develop"]), effects: ["reads","decides","transacts","suspends","no-rollback"], loadPolicy: "auto-eligible",
    keywords: ["local ai","runtime optimizer","optimize pc","performance","gpu","vram","ram","swap","zram","thermals","model server","llm runtime","benchmark"],
    when: "The task is specifically auditing or optimizing the local machine for AI/model runtimes.",
    where: "Its OBSERVE→REVIEW→EXECUTE→VERIFY stages nest inside D.M.T. GROUND→CONSTRAIN→EXECUTE→VERIFY.",
    how: "Run R0 read-only observation first, rank evidence-backed opportunities, require scoped approval for R1/R2 changes, keep R3 recommendation-only unless exact action is explicitly authorized, and verify before/after.",
    stop: "Stop when no reproducible bottleneck/opportunity remains or the next change exceeds the authorized risk level."
  },
  {
    id: "make-build-ledger", actor: "LegacyLedgerReaderActor", phases: P(["grounded"]),
    modes: M(["plan","debug","develop","brainstorm"]), effects: ["reads"], loadPolicy: "legacy-readonly",
    keywords: ["make-build-ledger","legacy ledger"],
    when: "Only when explicitly requested for compatibility/audit of the legacy ledger format.",
    where: "GROUND as read-only compatibility evidence.",
    how: "Do not evolve it as a competing standard; prefer `dynamic-build-ledger` for active governance.",
    stop: "Never auto-select or initialize it."
  },
  {
    id: "i-have-adhd", actor: "OutputStyleActor", phases: P(["captured","encoded","exploring","grounded","constrained","committed","executing","verified","decoded","formatted"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["computes"], loadPolicy: "explicit-only",
    keywords: ["/i-have-adhd","i-have-adhd","adhd mode","stop adhd mode"],
    when: "Only when the user explicitly invokes this output-style skill; never infer activation from personal traits or writing style.",
    where: "Presentation/update shaping across active phases; it must not change engine authority or technical conclusions.",
    how: "Load once when explicitly activated and honor its persistence/deactivation words while allowing higher-priority safety/harness constraints to win.",
    stop: "Deactivate only on the skill's explicit stop/normal-mode language or session end."
  },
  {
    id: "mr-meeseeks", actor: "ComedyOverlayActor", phases: P(["captured","encoded","exploring","grounded","constrained","committed","executing","verified","decoded","formatted"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["computes"], loadPolicy: "explicit-only",
    keywords: ["mr-meeseeks","meeseeks","april fools"],
    when: "Only when the user explicitly activates the comedy/persona mode or requests its April Fools behavior.",
    where: "Output/persona overlay only; never authority, safety, evidence, or mutation policy.",
    how: "Keep real task completion and safety intact beneath the comedic overlay; obey the skill's own exhaustion/deactivation rules.",
    stop: "Stop on explicit deactivation or its session exhaustion condition."
  },
  {
    id: "planning-brainstorm-light-research", actor: "IncubationActor", phases: P(["captured","encoded","exploring","grounded"]),
    modes: M(["brainstorm","plan"]), effects: ["reads","decides","computes"], loadPolicy: "installed-only",
    keywords: ["brainstorm","idea space","incubation","light research","possible use case","planning brainstorm"],
    when: "Early idea-space needs structured brainstorming/light research without prematurely freezing architecture.",
    where: "CAPTURE→EXPLORE, before deeper engineering feasibility work.",
    how: "Keep idea≠decision, feasible≠selected, selected≠authorized, and planned≠implemented; hand off to development planning only when engineering reality matters.",
    stop: "Stop when a bounded portfolio/next research question is ready; do not initialize project governance merely because an idea became interesting."
  },
  {
    id: "dev-planning-research", actor: "DevelopmentResearchActor", phases: P(["encoded","exploring","grounded","constrained","committed"]),
    modes: M(["plan","develop","debug"]), effects: ["reads","decides","computes"], loadPolicy: "installed-only",
    keywords: ["development planning","feasibility","architecture research","implementation plan","engineering reality","dev research"],
    when: "A selected idea/intention needs evidence-backed engineering feasibility, architecture, implementation boundaries, and verification planning.",
    where: "GROUND→CONSTRAIN→COMMIT after light brainstorming, before significant mutation.",
    how: "Separate intent, proposed action, authorized action, feasibility, implementation and verification; load bounded project state and expand evidence only as needed.",
    stop: "Stop at an executable evidence-backed plan with explicit non-goals/unknowns; do not treat intent as blanket mutation authority."
  },
  {
    id: "project-review-suggestions", actor: "ProjectReviewActor", phases: P(["grounded","constrained","verified","decoded"]),
    modes: M(["plan","debug","develop"]), effects: ["reads","decides"], loadPolicy: "installed-only",
    keywords: ["project review","suggestions","goblins","maintainability","packaging risk","polish","code health","release risk"],
    when: "During active development when the user wants a bounded advisory review for maintainability, packaging, docs, secrets, attribution, testing, or future release problems.",
    where: "GROUND/VERIFY; advisory by default and before release finalization.",
    how: "Match requested review depth, classify findings with evidence/severity, distinguish suggestions from required work, and do not silently turn findings into mutations.",
    stop: "Stop after the bounded review and ranked recommendations; do not auto-fix unless separately committed."
  },
  {
    id: "public-release-finalizer", actor: "ReleaseGateActor", phases: P(["grounded","constrained","verified","decoded","formatted","saved"]),
    modes: M(["plan","develop"]), effects: ["reads","decides","suspends"], loadPolicy: "installed-only",
    keywords: ["public release","release finalizer","release readiness","publish","npm publish","github release","final release","public repo"],
    when: "Immediately before a project is made public or a public release/package is prepared.",
    where: "VERIFY/SAVE as a release gate after ordinary project review and implementation verification.",
    how: "Inspect exact repo/branch/target, mandatory secret/license/working-tree/readme/package checks, report readiness state, and keep publication itself outside the skill's authority.",
    stop: "Stop at readiness verdict; never stage/commit/push/release/publish merely because finalization passed."
  },
  {
    id: "build-tt-handoff", actor: "HandoffActor", phases: P(["grounded","constrained","committed","executing","verified","decoded","formatted","saved"]),
    modes: M(["plan","debug","brainstorm","develop"]), effects: ["reads","computes","transacts"], loadPolicy: "installed-only",
    keywords: ["handoff","builder handoff","model replacement","fresh session","phase boundary","context reset"],
    when: "Before model/builder replacement, major context reset/pause, or after substantial architecture/implementation when a durable operational handoff is needed.",
    where: "SAVE/compaction boundary; can also checkpoint at major phase boundaries.",
    how: "Produce one logical handoff record, preserve observed/inferred/assumed distinctions, record authority/evidence/risks/next bounded work, and serialize consistently when dual formats are enabled.",
    stop: "Stop when another competent builder can resume without repeating archaeology or inventing state."
  },
  {
    id: "build-tt-rake", actor: "RetrospectiveActor", phases: P(["verified","decoded","formatted","saved"]),
    modes: M(["debug","develop","plan"]), effects: ["reads","decides","computes"], loadPolicy: "installed-only",
    keywords: ["rake","retrospective","post-build","scar map","lessons learned","gremlins","hindsight"],
    when: "After substantial implementation/debug/release preparation or milestone completion when hindsight should be captured.",
    where: "After VERIFY, normally after the work—not during mutation.",
    how: "Remain read-only, record lessons/gremlins/misleading success/missing instrumentation, and preserve historical epistemics instead of rewriting hindsight as obvious foresight.",
    stop: "Stop after the retrospective artifact; do not fix anything discovered during the rake."
  },
  {
    id: "build-tt-adhd", actor: "DivergentTestimonyActor", phases: P(["exploring","grounded","constrained","verified","decoded"]),
    modes: M(["brainstorm","plan","develop","debug"]), effects: ["reads","computes"], loadPolicy: "installed-only",
    keywords: ["build-tt-adhd","builder testimony","ted talk","architectural intuition","context loss","whiteboard"],
    when: "A substantial phase produced useful intuition/connections that may disappear before handoff or compression, or the user explicitly requests this testimony mode.",
    where: "Late EXPLORE/GROUND or before handoff; not on trivial work.",
    how: "Capture divergent intuition with observed/inferred/assumed/speculative labels; keep it separate from project truth and decisions.",
    stop: "Stop once potentially useful mental-model residue is captured; do not promote it into requirements."
  }
]

const byId = new Map(CURRENT_SKILL_CATALOG.map(x => [x.id, x]))
const ALWAYS_EXPLICIT = new Set(["i-have-adhd","mr-meeseeks","research-module"])

function words(s: string): string { return s.toLowerCase().replace(/[^a-z0-9@./_-]+/g, " ") }

export function getSkillDescriptor(id: string): SkillDescriptor | undefined { return byId.get(id) }

export function routeSkills(state: STFRunState, input: SkillRouteInput = {}): SkillRouteResult {
  const task = (input.task ?? state.goal ?? "").trim()
  const hay = words(`${task} ${state.goal} ${state.mode} ${state.phase}`)
  const available = input.availableIds ? new Set(input.availableIds) : undefined
  const explicit = input.explicitSkill?.trim()
  const scored: SkillRouteCandidate[] = []

  for (const d of CURRENT_SKILL_CATALOG) {
    const isExplicit = explicit === d.id
    if (explicit && !isExplicit) continue
    if (!isExplicit && (d.loadPolicy === "explicit-only" || d.loadPolicy === "legacy-readonly")) continue
    if (!isExplicit && ALWAYS_EXPLICIT.has(d.id)) continue
    let score = 0
    const reason: string[] = []
    if (isExplicit) { score += 100; reason.push("explicitly requested") }
    if (d.phases.includes(state.phase)) { score += 8; reason.push(`phase ${state.phase}`) }
    if (!d.modes || d.modes.includes(state.mode)) { score += 5; reason.push(`mode ${state.mode}`) }
    let hits = 0
    for (const k of d.keywords) if (hay.includes(words(k).trim())) hits++
    if (hits) { score += Math.min(24, hits * 4); reason.push(`${hits} trigger match${hits===1?"":"es"}`) }
    if (!isExplicit && hits === 0) continue
    const avail: boolean | "unknown" = available ? available.has(d.id) : "unknown"
    if (available && !avail) { score -= 30; reason.push("not advertised by current OpenCode skill registry") }
    if (d.loadPolicy === "installed-only") reason.push("load only if OpenCode advertises this ID")
    scored.push({ id:d.id, score, actor:d.actor, effects:d.effects, when:d.when, where:d.where, how:d.how, stop:d.stop, available:avail, loadPolicy:d.loadPolicy, reason, notes:d.notes })
  }

  scored.sort((a,b) => b.score-a.score || a.id.localeCompare(b.id))
  const eligible = scored.filter(x => x.available !== false)
  const take = Math.max(1, Math.min(input.limit ?? 3, 5))
  const primary = eligible[0]
  return {
    actor: "SkillRouterActor", phase: state.phase, mode: state.mode, task,
    primary,
    alternates: eligible.slice(1,take),
    instruction: primary
      ? `Load exactly one primary skill with OpenCode's native skill tool: skill({ name: "${primary.id}" }). Read its body/supporting files only as instructed. Record activation with dmt_skill_event, obey the skill's narrower gates, then complete/fail it before activating an unrelated skill.`
      : `No eligible routed skill is established. Continue with the normal Goblin-D.M.T. actor for this phase; do not invent a missing skill.`,
    catalog: "user-skills-2026-09-10/f3949bc7"
  }
}
