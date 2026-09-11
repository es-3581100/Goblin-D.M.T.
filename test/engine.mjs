import test from "node:test"
import assert from "node:assert/strict"
import { MachineActor, LazyGraph, validateLedgerConsistency } from "../dist/engine/index.js"

test("state machine is phase-bound and hash-chained", async () => {
  const m = new MachineActor()
  let s = await m.begin({ goal: "x", mode: "plan", anchors: ["preserve API"] }, "USER")
  assert.equal(s.phase, "captured")
  s = await m.transition("ENCODE", { facts: ["repo exists"], unknowns: ["which module"] })
  s = await m.transition("EXPLORE", { candidates: [{id:"a",summary:"A"},{id:"b",summary:"B"}] })
  s = await m.transition("GROUND", { evidence: [{kind:"file",source:"x.ts",claim:"A fits"}] })
  s = await m.transition("CONSTRAIN", { candidates: [{id:"a",summary:"A",status:"selected"}], selected:"a" })
  s = await m.transition("COMMIT", { selected:"a" })
  s = await m.transition("DECODE", { decoded:"# Plan\n\nDo A.\n" })
  assert.equal(s.phase, "decoded")
  assert.equal(s.ledger.length, 7)
  assert.notEqual(s.ledger.at(-1).hash, s.ledger.at(-2).hash)

  const badLedger = `# Build Ledger

## Classification summary

| status | count |
|---|---:|
| complete | 1 |
| partial | 0 |
| blocked | 0 |
| not_started | 0 |
| unknown | 0 |

Counts: 1 items.

## Evidence table

| # | item | status | evidence |
|---|---|---|---|
| 1 | parser | complete | test green |
| 2 | docs | complete | docs present |
`
  const bad = validateLedgerConsistency(badLedger)
  assert.equal(bad.applicable, true)
  assert.equal(bad.ok, false)
  assert.equal(bad.observed.complete, 2)
  assert.match(bad.mismatches.join("\n"), /complete: declared 1, observed 2/)
  assert.match(bad.mismatches.join("\n"), /total: declared 1, observed 2/)

  const repaired = validateLedgerConsistency(
    badLedger.replace("| complete | 1 |", "| complete | 2 |").replace("Counts: 1 items.", "Counts: 2 items.")
  )
  assert.equal(repaired.ok, true)
})

test("debug/develop require execute+verify before decode", async () => {
  const m = new MachineActor()
  await m.begin({ goal:"bug", mode:"debug" })
  await m.transition("ENCODE", {})
  await m.transition("EXPLORE", { candidates:[{id:"h1",summary:"race"}] })
  await m.transition("GROUND", { evidence:[{kind:"log",source:"log",claim:"race observed"}] })
  await m.transition("CONSTRAIN", { selected:"h1" })
  await m.transition("COMMIT", { selected:"h1" })
  await assert.rejects(() => m.transition("DECODE", {decoded:"x"}), /must EXECUTE and VERIFY/)
  await m.transition("EXECUTE", { execution:["patched"] })
  await m.transition("VERIFY", { verification:["test green"] })
  const s = await m.transition("DECODE", { decoded:"fixed" })
  assert.equal(s.phase,"decoded")
})

test("user commit approval is not grantable by ordinary transition", async () => {
  const m = new MachineActor()
  await m.begin({ goal:"x", mode:"plan", requireCommitApproval:true })
  await m.transition("ENCODE", {})
  await m.transition("EXPLORE", {candidates:[{id:"a",summary:"a"}]})
  await m.transition("GROUND", {evidence:[{kind:"user",source:"task",claim:"ok"}]})
  await m.transition("CONSTRAIN", {selected:"a"})
  await assert.rejects(() => m.transition("COMMIT", {selected:"a"}), /user approval required/)
  await m.approveCommit()
  const s = await m.transition("COMMIT", {selected:"a"})
  assert.equal(s.phase,"committed")
})

test("lazy graph evaluates shared dependency once", async () => {
  let hits=0
  const g=new LazyGraph([
    {id:"source",run:()=>{hits++;return 3}},
    {id:"a",deps:["source"],run:d=>d.source+1},
    {id:"b",deps:["source"],run:d=>d.source+2},
    {id:"out",deps:["a","b"],run:d=>d.a+d.b}
  ])
  assert.equal(await g.render("out",{}),9)
  assert.equal(hits,1)
})
