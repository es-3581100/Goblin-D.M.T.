# Goblin-D.M.T. v0.3.0 — skill-routing end-to-end smoke

Date: 2026-09-10

## Scope

This smoke verifies the D.M.T. package against a local contract-shaped mock OpenCode runtime plus real CLI/process/file behavior available in the test container.

It does **not** claim a live OpenCode/provider run: neither `opencode` nor `opencode2` was installed in the execution environment.

## Skill-pack input

Source: `opencode-skillz-master(2).zip`  
SHA-256: `f3949bc7e88805d62814d209084481567de22ee4ba8b3939f948a6f2fa5f7d02`

Inventory: **14 native SKILL.md / 7 direct workflow sources / 23 taxonomy-only / 21 curated routes**.

All 14 native skill IDs/descriptions passed the stable OpenCode naming/description structural audit used here.

Compatibility warning: `i-have-adhd` contains extra frontmatter from an adjacent ecosystem (`disable-model-invocation` and nested Hermes metadata). D.M.T. leaves the user's skill unchanged and instead uses `g-dmt` skill permissions plus the router to enforce explicit/ask-gated activation.

## Result

**PASS — 25/25 checks.**

The suite verifies renamed init layout; explicit-only skill gates; CLI route/activate/complete round-trip; prompt stdin; MarkItDown-compatible piping; shell-safe OpenCode argv; package contents; live cross-process commit approval; prompt metadata sync; phase/hash chain; execute-before-verify/decode discipline; no self-granted user approval; lazy dependency caching; plugin id; stable-host full lifecycle; OpenCode 2 nine-tool registration and host skill filtering; 14/7/23 inventory classification; no taxonomy ghosts; snapshot/plugin-builder routing; explicit-only handling; DBL precedence over legacy ledger; missing-skill filtering; serialized skill activation; and wrong-skill completion rejection.

## Boundaries proven by the mock

- CLI user approval refreshes into an already-running engine.
- Skill activation cannot modify authority/edit mask/commit approval.
- Edit masks cover direct edits and parsed `apply_patch` paths.
- Unresolvable masked patch targets fail closed.
- Agent external sync is denied by default.
- Active skill survives compaction state.
- Taxonomy metadata cannot manufacture an executable skill.

## Not proven

This release does not prove real OpenCode binary/UI behavior, native permission dialogs, Bun/npm download behavior inside OpenCode, provider-backed generation, every external MarkItDown conversion, npm registry availability of `dmt`, or real network-backed storage.

## Next live smoke

Install the tarball into a real OpenCode 1.18.30+ workspace, run `dmt init`, prove `g-dmt` agent/skill/plugin discovery, route and execute `workspace-snapshot` read-only, verify the active skill survives compaction, then test one local masked edit with explicit commit approval.

## Packed npm artifact smoke

**PASS.** After `npm pack`, the produced `dmt-0.3.0.tgz` was extracted into a fresh blank workspace. The CLI from the extracted tarball successfully:

```text
init
-> begin(develop)
-> skills route(make-an-opencode-plugin)
-> skills event activate
-> state (active skill observed)
-> skills event complete
-> state (completed history observed)
```

The fresh workspace contained `.opencode/agents/g-dmt.md`, `.opencode/skills/g-dmt/SKILL.md`, and `.g-dmt/config.json`. The route was filtered through an explicit available-ID list, the active skill was persisted, completion removed it from `active`, and the ledger advanced to logical clock 3.

This is reported separately from the 25 automated source/mock tests.
