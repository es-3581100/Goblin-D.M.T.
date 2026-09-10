import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { StableTextFusionRuntime } from '../dist/engine/runtime.js'

async function projectConfig(root, approval=true) {
  await mkdir(path.join(root,'.stable-text-fusion'),{recursive:true})
  await writeFile(path.join(root,'.stable-text-fusion','config.json'), JSON.stringify({
    stateDir:'.stable-text-fusion', strictPhaseGate:true, mutationTools:['edit','write','apply_patch','patch'],
    agentCanSave:true, agentCanSync:false, autoCheckpoint:true, markitdownCommand:'markitdown', markitdownMode:'go',
    requireCommitApproval:approval, remoteDir:''
  }))
}

test('long-lived runtime observes external CLI commit approval without restart', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'stf-cross-'))
  try {
    await projectConfig(root,true)
    const rt=await StableTextFusionRuntime.create(root)
    await rt.begin({goal:'x',mode:'plan',editMask:['src/a.ts']})
    await rt.transition('ENCODE',{facts:['f'],unknowns:['u']})
    await rt.transition('EXPLORE',{candidates:[{id:'a',summary:'a'}]})
    await rt.transition('GROUND',{evidence:[{kind:'file',source:'x',claim:'c'}]})
    await rt.transition('CONSTRAIN',{selected:'a'})
    const cli=path.resolve('dist/cli.js')
    const p=spawnSync(process.execPath,[cli,'approve','commit'],{cwd:root,encoding:'utf8'})
    assert.equal(p.status,0,p.stderr)
    assert.equal((await rt.state()).state.control.userGate.commitApproved,true)
    assert.equal((await rt.transition('COMMIT')).state.phase,'committed')
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('prompt push/pull preserves prompt metadata', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'stf-sync-'))
  const remote=await mkdtemp(path.join(os.tmpdir(),'stf-remote-'))
  try {
    await projectConfig(root,false)
    const rt=await StableTextFusionRuntime.create(root)
    await rt.storage.savePrompt('demo','# Demo\n','test')
    await rt.storage.push('prompt','demo',remote)
    const fs=await import('node:fs/promises')
    assert.ok(await fs.stat(path.join(remote,'prompts','demo.meta.json')))
    await fs.rm(path.join(root,'.stable-text-fusion','prompts','demo.md'))
    await fs.rm(path.join(root,'.stable-text-fusion','prompts','demo.meta.json'))
    await rt.storage.pull('prompt','demo',remote)
    assert.ok(await fs.stat(path.join(root,'.stable-text-fusion','prompts','demo.meta.json')))
  } finally { await rm(root,{recursive:true,force:true}); await rm(remote,{recursive:true,force:true}) }
})
