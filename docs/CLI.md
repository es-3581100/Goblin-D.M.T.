# Goblin-D.M.T. CLI

Primary executable: `dmt`  
Compatibility aliases in v0.3.0: `g-dmt`, `stf`, `stable-text-fusion`.

```text
dmt init
dmt begin --mode plan|debug|brainstorm|develop [--strength local] <goal>
dmt state
dmt transition EVENT [--patch JSON]
dmt approve commit
dmt checkpoint
dmt format [--profile markdown|plain|json] [FILE|-]
dmt ingest FILE... [--save NAME] [--stdout]
dmt prompt save NAME [FILE|-]
dmt prompt load NAME
dmt prompt list
dmt skills catalog
dmt skills route [TASK] [--explicit SKILL] [--available JSON]
dmt skills event activate|complete|fail SKILL [--reason TEXT]
dmt emit [RUN_ID]
dmt push prompt|run NAME [--remote DIR] [--overwrite]
dmt pull prompt|run NAME [--remote DIR] [--overwrite]
dmt opencode --prompt NAME [--model provider/model] [--agent name] [--host v1|v2] [--bin PATH]
```

`dmt skills route` returns routing metadata; OpenCode's native skill loader loads the actual skill body. `dmt skills event` records activation/completion/failure in canonical state. Only one skill may be active at a time.

```bash
dmt ingest design.pdf --stdout | dmt prompt save design -
dmt prompt load design | your-command
```

External push/pull requires an explicit target and is distinct from local save.
