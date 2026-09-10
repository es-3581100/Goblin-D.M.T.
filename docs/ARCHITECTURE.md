# Goblin-D.M.T. architecture

Goblin-D.M.T. is an actor-driven coordination runtime for OpenCode. The active model generates and judges local work; the D.M.T. engine owns canonical phase, run state, edit scope, skill activation, user gates, logical clock, and resumability.

```text
OpenCode session/model
       |
       v
  g-dmt agent
       |
       v
ENGINE_PROMPT delta
       |
       v
single-writer D.M.T. engine
   |       |       |
   |       |       +--> SkillRouterActor -> native OpenCode skill
   |       +----------> evidence/exploration actors
   +------------------> constraint/edit-mask actors
       |
       v
commit -> execute -> verify -> decode -> format -> save
```

## Host separation

The package exposes a stable-host `server(ctx)` adapter and an OpenCode 2 `setup(ctx)` adapter around the same engine. Host code is an adapter, not a second source of run truth.

## Canonical state

State schema: `g-dmt/state-v1`.

State is single-writer and carries phase, conditioning, branches/evidence, mutation envelope, active/completed/failed skill records, outputs, and provenance hashes. A logical clock and hash-chained ledger preserve ordering.

## Skill plane

`SkillRouterActor` consumes task text, phase and the available-skill set. It returns a compact route with actor, preferred phase, when/how/stop policy. The full skill body is not embedded in state.

Only actually available IDs may execute. Taxonomy-only entries remain metadata. Active-skill identity survives compaction/model handoff.

## Mutation plane

Strength controls intended change amount. Edit masks control writable surface. Inspection may leave the mask; mutation may not. `apply_patch` targets are parsed and checked; unknown targets fail closed under an active mask.

## User plane

Configured commit approval, scope escalation, remote sync, push/publication/deployment and irreversible effects remain user-owned boundaries.

## Persistence

`.g-dmt/` is the canonical new local state directory. Legacy `.stable-text-fusion/config.json` remains readable only for migration compatibility.

## Lineage

Dream Textures informed host/worker separation and cached dependency evaluation. NanoBananaEditor informed generate/edit/mask and non-destructive variants. Verse informed effect/failure/concurrency semantics. Text-Fusion is the direct pre-rename runtime lineage.
