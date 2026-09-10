import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const cli=path.join(repo,'dist','cli.js')
function run(root,args,{input,env}={}){ return spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',input,env:{...process.env,...env}}) }

async function tmp(){ return mkdtemp(path.join(os.tmpdir(),'dmt-cli-')) }

test('dmt init installs canonical g-dmt agent, skill, and config',async()=>{
 const root=await tmp(); try{
  const r=run(root,['init']); assert.equal(r.status,0,r.stderr)
  for(const f of ['.opencode/agents/g-dmt.md','.opencode/skills/g-dmt/SKILL.md','.g-dmt/config.json']) await stat(path.join(root,f))
  assert.match(r.stdout,/"plugin": \["dmt"\]/)
  assert.match(r.stdout,/"plugins": \["dmt"\]/)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('bundled agent structurally gates explicit-only user skills',async()=>{
 const text=await readFile(path.join(repo,'assets/opencode/agents/g-dmt.md'),'utf8')
 assert.match(text,/"research-module": ask/)
 assert.match(text,/"i-have-adhd": ask/)
 assert.match(text,/"mr-meeseeks": ask/)
 assert.match(text,/"make-build-ledger": ask/)
 assert.match(text,/permission:\n[\s\S]*task:/)
})

test('CLI skill route and skill state events round trip',async()=>{
 const root=await tmp(); try{
  assert.equal(run(root,['init']).status,0)
  assert.equal(run(root,['begin','--mode','plan','Create a workspace snapshot from this ZIP for handoff']).status,0)
  const routed=run(root,['skills','route','Create a workspace snapshot from this ZIP for handoff','--available','["workspace-snapshot","prompt-dev-formalization"]'])
  assert.equal(routed.status,0,routed.stderr); assert.equal(JSON.parse(routed.stdout).primary.id,'workspace-snapshot')
  assert.equal(run(root,['skills','event','activate','workspace-snapshot','--reason','archive identity']).status,0)
  assert.equal(JSON.parse(run(root,['state']).stdout).state.skills.active.id,'workspace-snapshot')
  assert.equal(run(root,['skills','event','complete','workspace-snapshot','--reason','snapshot validated']).status,0)
  assert.equal(JSON.parse(run(root,['state']).stdout).state.skills.history.at(-1).status,'completed')
 }finally{await rm(root,{recursive:true,force:true})}
})

test('prompt stdin save/load remains pipe-safe',async()=>{
 const root=await tmp(); try{
  assert.equal(run(root,['init']).status,0)
  const s=run(root,['prompt','save','demo','-'],{input:'# Demo\n\nhello\n'}); assert.equal(s.status,0,s.stderr)
  const l=run(root,['prompt','load','demo']); assert.equal(l.status,0,l.stderr); assert.match(l.stdout,/# Demo/)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('MarkItDown boundary uses argv without shell and ingests converter output',async()=>{
 const root=await tmp(); try{
  assert.equal(run(root,['init']).status,0)
  const converter=path.join(root,'fake-markitdown')
  await writeFile(converter,'#!/bin/sh\nprintf \'# Converted\\n\\nsource=%s\\n\' "$1" > "$2"\n'); await chmod(converter,0o755)
  await writeFile(path.join(root,'design.pdf'),'binary-ish')
  const cfgp=path.join(root,'.g-dmt/config.json'); const cfg=JSON.parse(await readFile(cfgp,'utf8')); cfg.markitdownCommand=converter; cfg.markitdownMode='go'; await writeFile(cfgp,JSON.stringify(cfg))
  const r=run(root,['ingest','design.pdf','--stdout']); assert.equal(r.status,0,r.stderr); assert.match(r.stdout,/# Converted/)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('opencode wrapper passes hostile prompt as one argv value with shell disabled',async()=>{
 const root=await tmp(); const marker=path.join(os.tmpdir(),`dmt-pwn-${process.pid}`); try{
  assert.equal(run(root,['init']).status,0)
  const prompt=`hello ; touch ${marker}\n`
  assert.equal(run(root,['prompt','save','hostile','-'],{input:prompt}).status,0)
  const fake=path.join(root,'fake-opencode'), out=path.join(root,'argv.json')
  await writeFile(fake,'#!/bin/sh\nnode -e \'require("fs").writeFileSync(process.env.DMT_ARGV_OUT, JSON.stringify(process.argv.slice(1)))\' "$@"\n'); await chmod(fake,0o755)
  const r=run(root,['opencode','--prompt','hostile','--bin',fake],{env:{DMT_ARGV_OUT:out}}); assert.equal(r.status,0,r.stderr)
  const argv=JSON.parse(await readFile(out,'utf8')); assert.equal(argv[0],'run'); assert.equal(argv.length,2); assert.match(argv[1],/hello ; touch/)
  await assert.rejects(()=>stat(marker),/ENOENT/)
 }finally{await rm(root,{recursive:true,force:true}); await rm(marker,{force:true})}
})

test('npm pack manifest contains renamed control plane and skill-routing artifacts',()=>{
 const r=spawnSync('npm',['pack','--dry-run','--json'],{cwd:repo,encoding:'utf8'}); assert.equal(r.status,0,r.stderr)
 const p=JSON.parse(r.stdout)[0]; assert.equal(p.name,'dmt'); assert.equal(p.version,'0.3.0')
 const files=new Set(p.files.map(x=>x.path))
 for(const f of ['assets/opencode/agents/g-dmt.md','assets/opencode/skills/g-dmt/SKILL.md','assets/skill-routing/current-skills.json','docs/SKILL-ROUTING.md','dist/engine/skills.js']) assert.ok(files.has(f),f)
})
