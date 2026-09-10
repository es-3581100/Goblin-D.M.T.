# Goblin-D.M.T. — Current Skill Routing

This document records the skill-routing contract integrated in v0.3.0.

## Source snapshot

- User skill pack: `opencode-skillz-master(2).zip`
- SHA-256: `f3949bc7e88805d62814d209084481567de22ee4ba8b3939f948a6f2fa5f7d02`
- Native unique `SKILL.md` definitions found: **14**
- Direct donSquad workflow prompt sources found: **7**
- Taxonomy-only skill IDs with no executable `SKILL.md` in the pack: **23**

Goblin-D.M.T. does **not** vendor or silently shadow the user's skill bodies. The runtime stores routing metadata and asks OpenCode to load the winning installed definition by exact skill ID. This preserves OpenCode's own source precedence and lets global/project skills continue to evolve independently.

## Current OpenCode contract

D.M.T. intentionally follows OpenCode's lazy skill model:

- project skills live under `.opencode/skills/...`;
- the model should receive compact skill discovery metadata rather than every body;
- the exact native skill body is loaded only when the skill is selected;
- skill permission remains an OpenCode host decision;
- V2 derives the callable ID from the skill path and exposes the current registry through `ctx.skill.list()`.

References consulted for v0.3.0:

- https://opencode.ai/docs/skills
- https://opencode.ai/v2/docs/skills
- https://opencode.ai/v2/docs/build/plugins

This is why the D.M.T. catalog is **routing metadata**, not a second skill loader or a vendored copy of the user's skill bodies.

## OpenCode loading rule

```text
phase + task + advertised skill IDs
            |
            v
      SkillRouterActor
            |
            v
      dmt_skill_route
            |
      primary ID or none
            |
            v
  OpenCode native skill tool
            |
            v
  dmt_skill_event activate
            |
       bounded workflow
            |
            v
    complete OR fail
```

Only one primary skill should be active at a time unless a loaded skill explicitly requires a second capability. Skill activation never grants commit approval, mask expansion, remote sync, push, publication, deletion, credentials, or broader filesystem/network authority.

## Routing table

| Skill | D.M.T. actor | Preferred phase | Policy | Operational use |
|---|---|---|---|---|
| `workspace-snapshot` | SnapshotActor | CAPTURE/GROUND | auto-eligible | Stable archive/repo/file identity, handoff, resume, drift. Use deterministic snapshot helper/validation; never execute target merely to inspect it. |
| `zero-review-graph` | GraphEvidenceActor | GROUND/VERIFY | auto-eligible | Go/Rust/ZeroLang graph-first review/debug. Search → impact → context pack; graph is retrieval evidence, not proof. |
| `prompt-dev-formalization` | FormalizationActor | CONDITION-CONSTRAIN | auto-eligible | Convert loose development intent into a provenance-preserving one-shot build prompt with explicit requirement disposition. |
| `research-module` | ResearchCorpusActor | GROUND/SAVE | **explicit-only** | Create/manage bounded research corpora with C0→C4 source precedence and paired metadata. |
| `go-wiki-memory` | ReadOnlyMemoryActor | CAPTURE/GROUND | auto-eligible when referenced | Optional localhost/read-only shared context; never authority. |
| `dynamic-build-ledger` | LedgerActor | governed lifecycle | installed/intent gated | Use an existing DBL or explicit initialization request; the skill's exact first-init `666` gate remains binding. |
| `update-ledger-compact` | CompactionLedgerActor | pre-compaction | installed/intent gated | Persist DBL state before OpenCode compaction and reground afterward. |
| `make-an-opencode-plugin` | ExtensionBuilderActor | GROUND-VERIFY | auto-eligible | Version-aware OpenCode extension/plugin/custom-tool development and host verification. |
| `make-an-opencode-skill` | SkillBuilderActor | GROUND-VERIFY | auto-eligible | Build/repair/audit OpenCode skills and prove discovery/loading. |
| `make-a-new-local-repo` | RepositoryBootstrapActor | COMMIT-VERIFY | installed/intent gated | Bootstrap/adopt a repo; keep external push/publication separately authorized. |
| `local-ai-runtime-optimizer` | RuntimeOptimizerActor | GROUND-VERIFY | auto-eligible | Local model/runtime machine audit/optimization using OBSERVE→REVIEW→EXECUTE→VERIFY and R0-R3 gates. |
| `make-build-ledger` | LegacyLedgerReaderActor | GROUND | **legacy explicit/read-only** | Compatibility only. Prefer `dynamic-build-ledger`; never auto-select. |
| `i-have-adhd` | OutputStyleActor | presentation | **explicit-only** | User-activated output shaping only. Never infer activation from personal traits. |
| `mr-meeseeks` | ComedyOverlayActor | presentation | **explicit-only** | User-activated comedy/persona overlay only; no authority effects. |
| `planning-brainstorm-light-research` | IncubationActor | CAPTURE-EXPLORE | installed-only | Early idea-space/light research while preserving idea≠decision. |
| `dev-planning-research` | DevelopmentResearchActor | GROUND-COMMIT | installed-only | Feasibility/architecture/implementation planning after idea selection. |
| `project-review-suggestions` | ProjectReviewActor | GROUND/VERIFY | installed-only | Advisory project-quality/goblin review during active development. |
| `public-release-finalizer` | ReleaseGateActor | VERIFY/SAVE | installed-only | Public-release readiness gate; validation does not authorize publish/push/release. |
| `build-tt-handoff` | HandoffActor | boundary/SAVE | installed-only | Durable model/builder/session handoff with evidence/authority/next work. |
| `build-tt-rake` | RetrospectiveActor | post-VERIFY | installed-only | Read-only hindsight/scar map after implementation/debug/release preparation. |
| `build-tt-adhd` | DivergentTestimonyActor | late EXPLORE/handoff | installed-only | Preserve architectural intuition before compression without promoting speculation into project truth. |

## Recommended sequential compositions

- `workspace-snapshot` → `zero-review-graph` for large/archive Go/Rust review.
- `planning-brainstorm-light-research` → `dev-planning-research` when idea-space becomes engineering work.
- `project-review-suggestions` → `public-release-finalizer` before a public release.
- `dynamic-build-ledger` → `update-ledger-compact` at a governed compaction/handoff boundary.
- `make-an-opencode-skill` or `make-an-opencode-plugin` → `project-review-suggestions` for a post-build advisory audit.

These are sequences, not permission to load both skill bodies into context simultaneously. Finish the first skill, preserve its useful output in engine evidence/state, then load the next.

## Native vs legacy vs taxonomy

The uploaded pack contains three different classes:

1. **Native skill** — a real `SKILL.md` was found. OpenCode can discover it when installed in a recognized source.
2. **Legacy/direct workflow prompt** — useful workflow content exists, but this uploaded pack does not provide it as a native `SKILL.md`. D.M.T. routes it only if OpenCode actually advertises an installed definition.
3. **Taxonomy-only** — the skill-tree index names the concept but no executable skill body was found. It is never callable solely because the index names it.

The complete machine-readable inventory is `assets/skill-routing/current-skills.json`.
