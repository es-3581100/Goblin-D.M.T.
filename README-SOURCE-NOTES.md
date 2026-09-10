# Goblin-D.M.T. README source notes

Generated: 2026-09-10

## Authority order

1. Current `dmt@0.3.0` source tree
2. User's canonical rename: Goblin-D.M.T. / Goblin-Dynamic.Meta.Transfusion / `g-dmt` / npm+CLI `dmt`
3. Uploaded current skill pack: `opencode-skillz-master(2).zip`
4. Current OpenCode skill-discovery contracts consulted during this build
5. Brand/presentation rules supplied in this session

## Skill source

Uploaded skill-pack SHA-256:
`f3949bc7e88805d62814d209084481567de22ee4ba8b3939f948a6f2fa5f7d02`

D.M.T. records 14 native SKILL.md definitions, 7 direct workflow sources, and 23 taxonomy-only entries. Only actual/host-advertised skill IDs can execute.

## Render binding

README SHA-256 after the live-E2E/banner patch:
`39105c07d33c17d75f3bc849c89873bb3934a44bb40e7e85d5cc690759814d07`

`rendered-demo.html` must be regenerated before it can again be claimed as bound to this exact README snapshot.

## Verification language

The README's `25/25 PASS` still refers specifically to local compile/mock-host/CLI tests.

A separate live OpenCode end-to-end smoke passed on 2026-09-10 with:

```text
dmt                  0.3.0
opencode             1.18.30
model                tokenrouter/z-ai/glm-5.3-free
agent                g-dmt
skill                workspace-snapshot
result               PASS  GOBLIN_DMT_LIVE_E2E
```

That live proof covers project-local agent discovery, packed plugin isolation/import, all nine `dmt_*` tools, native skill loading, `dmt_state`, CLI → live-plugin state propagation, tracked-worktree immutability, ledger completion persistence, and post-turn server health.

It does not yet claim verification of the native OpenCode permission UI or a user-approved masked write.

## Dynamic documentation pipeline

`README.md` is the portable documentation authority.

The dynamic presentation path is:

```text
README.md
  -> scripts/render-readme.mjs
  -> rendered-demo.html
  -> site/index.html
  -> GitHub Pages
```

`.github/workflows/pages.yml` regenerates `site/index.html` from the current `README.md`
on relevant pushes to `main` and deploys the generated `site/` artifact. The workflow
has read-only repository-content permission plus the GitHub Pages deployment permissions;
it does not commit generated files back into the repository.

`rendered-demo.html` is a checked-in local preview artifact. Run `npm run docs:build`
before committing it when you want that repository copy to remain synchronized.

