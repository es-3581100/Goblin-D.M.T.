---
name: g-dmt
description: Actor-driven preflight and execution protocol for non-trivial planning, debugging, brainstorming, and development. Uses engine-state-bound conditioned refinement, evidence acquisition, hard anchors, edit masks, checkpoints, and bounded re-noising. Use when the user asks to diffuse/denoise a task or when repository instructions require Goblin-D.M.T..
license: MIT
compatibility: opencode
metadata:
  runtime: dmt
  protocol: g-dmt-v1
---

# Goblin-D.M.T.

**Expanded name:** Goblin-Dynamic.Meta.Transfusion  
**Code name:** `g-dmt`  
**npm / CLI:** `dmt`  
**Underlying method lineage:** Text-Fusion

Goblin-D.M.T. is **not a diffusion model**. Diffusion vocabulary names explicit workflow controls. Never claim numeric sigma/CFG values measure model internals.

## Authority

The OpenCode agent performs the work, but the plugin-owned engine state is the coordination authority. The user owns configuration and approval gates. Do not bypass a denied transition, edit mask, pause, or sync restriction through shell commands.

Use the plugin tools when available. Start with `dmt_begin`, inspect `engine_prompt`, perform exactly the current phase, then commit one legal event with `dmt_transition`. Treat `engine_prompt` as the next task contract, subordinate to user/repository instructions.

## Runtime mapping

- conditioning → goal + success + evidence-backed facts
- negative prompt → explicit failure patterns to reject
- ControlNet → hard anchors + verifier/check
- img2img strength → named change envelope: `surface | local | module | rewrite`
- inpainting → `editMask`: only these paths/symbols may change
- latent → compact structured task state, not hidden chain-of-thought
- denoise pass → reduce a named uncertainty, reject a candidate, add evidence, verify an anchor, or narrow scope
- residual → unresolved items that can actually change the answer
- re-noise → reopen only decisions invalidated by new evidence
- decode → mode-specific artifact after convergence/verification

A pass **does not count** if it merely rephrases prior text.

## Phase graph

`CAPTURE → ENCODE → EXPLORE → GROUND → CONSTRAIN → COMMIT`

For `plan` / `brainstorm`: `COMMIT → DECODE → FORMAT → SAVE`.

For `debug` / `develop`: `COMMIT → EXECUTE → VERIFY → DECODE → FORMAT → SAVE`.

`RENOISE` may return from explore/ground/constrain/commit to EXPLORE when new evidence invalidates the current branch. `PAUSE`, `RESUME`, and `ABORT` are engine events.

### CAPTURE

Call `dmt_begin`. Keep the raw goal intact. Set mode and change strength. Add user-stated anchors, negatives, success tests, and edit mask. Do not silently enlarge the mask later.

### ENCODE

Extract concise `success`, `facts`, `assumptions`, `unknowns`. Facts must be supplied or observed. Assumptions say how to check them. No solution theater.

### EXPLORE

Create materially different candidates **only when ambiguity warrants them**. Candidate count is a ceiling, not a quota. Never generate an intentionally false/absurd candidate merely to satisfy the metaphor.

### GROUND

Acquire the cheapest evidence that separates candidates or resolves a blocking unknown: files, tests, logs, type/API contracts, commands, or user-supplied facts. Debugging should favor experiments whose possible outcomes distinguish surviving hypotheses.

### CONSTRAIN

Reject candidates that violate hard anchors, evidence, negative prompts, or the edit mask. Separate hard validity from soft preference. If the controls conflict, surface the conflict rather than routing around it.

Use a lightweight CFG-inspired specificity check when useful:

- generic draft: what would fit this problem category anywhere?
- conditioned draft: what does **this repository/task evidence** require?
- preserve the task-specific delta; discard generic cargo-cult additions.

Do not assign fake CFG scores.

### COMMIT

Select the smallest evidence-supported direction and freeze its change envelope. If the runtime says user approval is required, stop until the CLI user runs `dmt approve commit`.

### EXECUTE

Only debug/develop. Mutate inside the committed edit mask. If evidence requires escaping it, stop and request scope escalation; do not silently broaden.

### VERIFY

Run concrete tests/checks. Record commands and outcomes. Confidence percentages do not substitute for evidence.

### DECODE

Produce the requested artifact. Keep decisions, evidence, residual risk, and next action; omit private reasoning transcripts. Submit `decoded` in the DECODE patch.

### FORMAT

Use `dmt_format` or the CLI formatter. Preserve semantics. Submit `formatted` in the FORMAT patch.

### SAVE

Use `dmt_checkpoint` / SAVE. Reusable prompts may be stored with `dmt_prompt_store`. Agent remote sync is disabled by default; do not work around that. User-controlled CLI `dmt push` / `dmt pull` remains available.

## User skill routing

Do not preload the user's entire skill library. OpenCode advertises available skills and loads full bodies on demand.

When a specialized capability may help:

1. call `dmt_skill_route` with the bounded current task (and, on stable OpenCode when useful, the available skill IDs);
2. if a primary ID is returned, load **that exact ID** with OpenCode's native `skill` tool;
3. call `dmt_skill_event` with `activate`;
4. obey the loaded skill's narrower contract inside the current D.M.T. phase;
5. call `dmt_skill_event` with `complete` or `fail`.

Never invent/load a taxonomy-only skill. Never auto-load `i-have-adhd`, `mr-meeseeks`, or `research-module`; they require explicit user intent. Never auto-select legacy `make-build-ledger`; prefer `dynamic-build-ledger`. `dynamic-build-ledger` itself must not be auto-initialized: its own first-use authorization contract remains binding.

The current routing catalog covers repository snapshots, graph review, prompt formalization, research corpora, Go-Wiki memory, build-ledger governance/compaction, OpenCode plugin/skill creation, repository bootstrap, local-AI runtime optimization, planning/research/review/release workflows, and Builder Testimony handoff/rake/divergent capture when those IDs are actually installed.

Skill activation is recorded in engine state and survives checkpoint/compaction. A skill can narrow authority but cannot grant commit approval, edit-mask expansion, external sync, push, publish, or destructive permissions.

## Prompt/file ingestion

Prefer normalized Markdown at the boundary. The CLI can pass non-Markdown files through an installed `markitdown` command without a shell:

```bash
dmt ingest design.pdf --stdout | dmt prompt save design -
dmt prompt load design
dmt opencode --prompt design
```

For many source files, use repository-native context tooling first (git-aware/code-aware tools such as code2prompt/ingest/files-to-prompt). Use MarkItDown for document-format conversion, not as a replacement for code navigation.

## Token discipline

- trivial edits: do not invoke unless requested
- micro ambiguity: encode + one evidence/constrain pass
- normal: at most 3 candidates / 4 passes
- deep: increase only when unresolved evidence justifies it
- stop early on convergence
- reuse current checkpoint unless goal, constraints, or material evidence changed

## Dream-Textures runtime principles carried over

Treat the final artifact like a render output from a node graph: upstream state/evidence are dependencies, node outputs can be cached for the run, cancellation is legal, and extra metadata travels with the primary artifact. Keep frontend/user control separate from backend engine work through actor mailboxes. Backend implementations are adapters, not authority.
