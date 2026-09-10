import test from 'node:test'
import assert from 'node:assert/strict'
import { MachineActor, routeSkills, CURRENT_SKILL_CATALOG } from '../dist/engine/index.js'

async function captured(goal='inspect archive', mode='plan') {
  const m = new MachineActor()
  const s = await m.begin({ goal, mode })
  return {m,s}
}

test('current skill catalog has curated executable routes without taxonomy ghosts', () => {
  const ids = new Set(CURRENT_SKILL_CATALOG.map(x => x.id))
  assert.equal(CURRENT_SKILL_CATALOG.length, 21)
  assert.ok(ids.has('workspace-snapshot'))
  assert.ok(ids.has('public-release-finalizer'))
  assert.ok(!ids.has('ash-skill'))
})

test('workspace snapshot routes first for archive identity work', async () => {
  const {s} = await captured('Create a stable snapshot of this ZIP for a model handoff')
  const r = routeSkills(s,{availableIds:['workspace-snapshot','prompt-dev-formalization']})
  assert.equal(r.primary?.id,'workspace-snapshot')
  assert.equal(r.primary?.available,true)
  assert.match(r.primary?.how ?? '',/deterministic helper/i)
})

test('OpenCode plugin builder routes for plugin work', async () => {
  const {s} = await captured('Build and smoke test an OpenCode V1 V2 plugin', 'develop')
  const r = routeSkills(s,{availableIds:['make-an-opencode-plugin','make-an-opencode-skill']})
  assert.equal(r.primary?.id,'make-an-opencode-plugin')
})

test('explicit-only presentation and research skills never auto-route', async () => {
  const {s} = await captured('Research this project and make the answer easy to read')
  const auto = routeSkills(s,{availableIds:['research-module','i-have-adhd','mr-meeseeks']})
  assert.equal(auto.primary,undefined)
  const explicit = routeSkills(s,{explicitSkill:'research-module',availableIds:['research-module']})
  assert.equal(explicit.primary?.id,'research-module')
})

test('legacy make-build-ledger is explicit/read-only while DBL may route by intent', async () => {
  const {s} = await captured('Update the Dynamic Build Ledger for this project')
  const r = routeSkills(s,{availableIds:['dynamic-build-ledger','make-build-ledger']})
  assert.equal(r.primary?.id,'dynamic-build-ledger')
  const legacy = routeSkills(s,{explicitSkill:'make-build-ledger',availableIds:['make-build-ledger']})
  assert.equal(legacy.primary?.id,'make-build-ledger')
  assert.equal(legacy.primary?.loadPolicy,'legacy-readonly')
})

test('routing filters a known skill that OpenCode does not advertise', async () => {
  const {s} = await captured('Snapshot this ZIP for handoff')
  const r = routeSkills(s,{availableIds:['prompt-dev-formalization']})
  assert.notEqual(r.primary?.id,'workspace-snapshot')
  assert.match(r.instruction,/No eligible routed skill|Load exactly one/)
})

test('skill activation is serialized in canonical state and phase does not advance', async () => {
  const {m} = await captured('Build plugin','develop')
  let s = await m.transition('SKILL_ACTIVATE',{skill:{id:'make-an-opencode-plugin',actor:'ExtensionBuilderActor',reason:'plugin task'}})
  assert.equal(s.phase,'captured')
  assert.equal(s.skills.active?.id,'make-an-opencode-plugin')
  await assert.rejects(() => m.transition('SKILL_ACTIVATE',{skill:{id:'workspace-snapshot'}}),/already active/)
  s = await m.transition('SKILL_COMPLETE',{skill:{id:'make-an-opencode-plugin'},note:'contract loaded and applied'})
  assert.equal(s.skills.active,undefined)
  assert.equal(s.skills.history.at(-1)?.status,'completed')
  assert.equal(s.skills.history.at(-1)?.id,'make-an-opencode-plugin')
})

test('skill completion cannot close the wrong active skill', async () => {
  const {m} = await captured('x')
  await m.transition('SKILL_ACTIVATE',{skill:{id:'workspace-snapshot'}})
  await assert.rejects(() => m.transition('SKILL_COMPLETE',{skill:{id:'zero-review-graph'}}),/does not match active skill/)
})
