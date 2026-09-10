import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { server, setup, id } from '../dist/index.js'

const advertised = [
  'workspace-snapshot','zero-review-graph','prompt-dev-formalization','research-module','go-wiki-memory',
  'dynamic-build-ledger','update-ledger-compact','make-an-opencode-plugin','make-an-opencode-skill',
  'make-a-new-local-repo','local-ai-runtime-optimizer','make-build-ledger','i-have-adhd','mr-meeseeks'
]

async function rootConfig(approval=true) {
  const root=await mkdtemp(path.join(os.tmpdir(),'dmt-host-'))
  await mkdir(path.join(root,'.g-dmt'),{recursive:true})
  await writeFile(path.join(root,'.g-dmt','config.json'),JSON.stringify({
    stateDir:'.g-dmt', strictPhaseGate:true, mutationTools:['edit','write','apply_patch','patch'],
    agentCanSave:true, agentCanSync:false, autoCheckpoint:true, markitdownCommand:'markitdown', markitdownMode:'go',
    requireCommitApproval:approval, remoteDir:'', skillRoutingEnabled:true, skillCatalog:'user-skills-2026-09-10/f3949bc7'
  }))
  return root
}

function j(s){ return JSON.parse(s) }

test('plugin identity is renamed to dmt',()=>assert.equal(id,'dmt'))

test('stable V1 mock executes skill-routed develop lifecycle end to end', async () => {
  const root=await rootConfig(true)
  try {
    const host=await server({worktree:root})
    const t=host.tool
    const names=Object.keys(t).sort()
    for(const n of ['dmt_begin','dmt_state','dmt_transition','dmt_checkpoint','dmt_format','dmt_prompt_store','dmt_skill_route','dmt_skill_event','dmt_sync']) assert.ok(names.includes(n),n)

    let env=j(await t.dmt_begin.execute({goal:'Build and test an OpenCode plugin',mode:'develop',strength:'local',edit_mask_json:'["src/**","test/**"]'}))
    assert.equal(env.state.phase,'captured')
    assert.match(env.state.runId,/^dmt-/)

    const route=j(await t.dmt_skill_route.execute({task:'Build and test an OpenCode plugin',available_json:JSON.stringify(advertised)}))
    assert.equal(route.primary.id,'make-an-opencode-plugin')
    assert.match(route.instruction,/skill\(\{ name: "make-an-opencode-plugin" \}\)/)

    env=j(await t.dmt_skill_event.execute({action:'activate',id:'make-an-opencode-plugin',actor:'ExtensionBuilderActor',reason:'OpenCode plugin task'}))
    assert.equal(env.state.skills.active.id,'make-an-opencode-plugin')

    const compact={context:[]}
    await host['experimental.session.compacting']({},compact)
    assert.match(compact.context.join('\n'),/Active skill: make-an-opencode-plugin/)

    await t.dmt_transition.execute({event:'ENCODE',patch_json:JSON.stringify({facts:['plugin source exists'],unknowns:['host compatibility']})})
    await t.dmt_transition.execute({event:'EXPLORE',patch_json:JSON.stringify({candidates:[{id:'dual',summary:'dual host entrypoint'}]})})
    await t.dmt_transition.execute({event:'GROUND',patch_json:JSON.stringify({evidence:[{kind:'file',source:'package.json',claim:'OpenCode V1/V2 deps declared'}]})})
    await t.dmt_transition.execute({event:'CONSTRAIN',patch_json:JSON.stringify({selected:'dual'})})

    await assert.rejects(()=>host['tool.execute.before']({tool:'edit'},{args:{filePath:'src/index.ts'}}),/phase gate/)

    const cli=path.resolve('dist/cli.js')
    const approve=spawnSync(process.execPath,[cli,'approve','commit'],{cwd:root,encoding:'utf8'})
    assert.equal(approve.status,0,approve.stderr)
    env=j(await t.dmt_state.execute({}))
    assert.equal(env.state.control.userGate.commitApproved,true)

    await t.dmt_transition.execute({event:'COMMIT',patch_json:JSON.stringify({selected:'dual'})})
    await host['tool.execute.before']({tool:'edit'},{args:{filePath:'src/index.ts'}})
    await host['tool.execute.before']({tool:'apply_patch'},{args:{patchText:'*** Begin Patch\n*** Update File: test/mock.mjs\n*** End Patch'}})
    await assert.rejects(()=>host['tool.execute.before']({tool:'edit'},{args:{filePath:'README.md'}}),/outside/)
    await assert.rejects(()=>host['tool.execute.before']({tool:'apply_patch'},{args:{patchText:'*** Begin Patch\n*** End Patch'}}),/fail-closed/)

    await t.dmt_transition.execute({event:'EXECUTE',patch_json:JSON.stringify({execution:['bounded edit']})})
    await t.dmt_transition.execute({event:'VERIFY',patch_json:JSON.stringify({verification:['mock host green']})})
    env=j(await t.dmt_skill_event.execute({action:'complete',id:'make-an-opencode-plugin',reason:'host contracts verified'}))
    assert.equal(env.state.skills.active,undefined)
    assert.equal(env.state.skills.history.at(-1).status,'completed')
    await t.dmt_transition.execute({event:'DECODE',patch_json:JSON.stringify({decoded:'# Result\n\nVerified.\n'})})
    await t.dmt_transition.execute({event:'FORMAT'})
    env=j(await t.dmt_transition.execute({event:'SAVE'}))
    assert.equal(env.state.phase,'saved')

    await assert.rejects(()=>t.dmt_sync.execute({action:'push',kind:'run',name:env.state.runId}),/agent sync disabled/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('V2 mock registers dmt tools and filters routes from ctx.skill.list', async () => {
  const root=await rootConfig(false)
  const tools=new Map(), toolHooks=new Map(), sessionHooks=new Map()
  try {
    const ctx={
      location:{directory:root},
      skill:{list:async()=>({data:advertised.map(id=>({id}))})},
      tool:{
        transform:async(fn)=>fn({add:(x)=>tools.set(x.name,x),list:()=>[...tools.values()]}),
        hook:async(name,fn)=>toolHooks.set(name,fn)
      },
      session:{hook:async(name,fn)=>sessionHooks.set(name,fn)}
    }
    await setup(ctx)
    for(const n of ['dmt_begin','dmt_state','dmt_transition','dmt_checkpoint','dmt_format','dmt_prompt_store','dmt_skill_route','dmt_skill_event','dmt_sync']) assert.ok(tools.has(n),n)
    await tools.get('dmt_begin').execute({goal:'Snapshot this ZIP for handoff',mode:'plan'})
    const routed=JSON.parse((await tools.get('dmt_skill_route').execute({task:'Snapshot this ZIP for handoff'})).content)
    assert.equal(routed.primary.id,'workspace-snapshot')
    await tools.get('dmt_skill_event').execute({action:'activate',id:'workspace-snapshot',reason:'archive identity'})
    const event={system:[]}
    await sessionHooks.get('context')(event)
    assert.match(event.system[0].text,/Active skill: workspace-snapshot/)
    const comp={system:[]}
    await sessionHooks.get('compaction')(comp)
    assert.match(comp.system[0].text,/skill=workspace-snapshot|Active skill: workspace-snapshot/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('uploaded skill inventory records native, legacy, and taxonomy-only distinctions',async()=>{
  const inv=JSON.parse(await readFile('assets/skill-routing/current-skills.json','utf8'))
  assert.equal(inv.source_sha256,'f3949bc7e88805d62814d209084481567de22ee4ba8b3939f948a6f2fa5f7d02')
  assert.equal(inv.skills.filter(x=>x.kind==='native-skill-md').length,14)
  assert.equal(inv.skills.filter(x=>x.kind==='legacy-prompt-source').length,7)
  assert.equal(inv.skills.filter(x=>x.kind==='taxonomy-only').length,23)
  assert.equal(inv.skills.find(x=>x.id==='make-an-opencode-plugin').kind,'native-skill-md')
  assert.equal(inv.skills.find(x=>x.id==='public-release-finalizer').kind,'legacy-prompt-source')
  assert.equal(inv.skills.find(x=>x.id==='ash-skill').kind,'taxonomy-only')
})
