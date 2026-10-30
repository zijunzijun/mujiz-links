import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, chmod, unlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPublisher, suggestMessage } from '../scripts/git-publish.mjs';
const exec = promisify(execFile);
const fixture = {profile:{name:'Test',bio:'Bio',avatarUrl:'https://example.com/avatar.png',theme:'light'},links:[{id:'one',title:'One',url:'https://example.com',isActive:true}],banners:[],socials:{instagram:'',facebook:'',email:''}};
const git = async (cwd,...args) => (await exec('git',args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:15000})).stdout.trim();
async function setup(t, initialContent = true, checks = async()=>{}) {
  const dir = await mkdtemp(path.join(os.tmpdir(),'mujiz-git-test-')); t.after(()=>rm(dir,{recursive:true,force:true}));
  const root=path.join(dir,'work'); const remote=path.join(dir,'remote.git'); await mkdir(root);
  await git(dir,'init','--bare',remote); await git(root,'init','--initial-branch=main');
  await git(root,'config','user.name','Portal Test'); await git(root,'config','user.email','portal-test@example.com');
  await writeFile(path.join(root,'README.md'),'Initial\n');
  if(initialContent)await writeFile(path.join(root,'content.json'),JSON.stringify(fixture,null,2)+'\n');
  await git(root,'add','.'); await git(root,'commit','-m','initial'); await git(root,'remote','add','origin',remote); await git(root,'push','-u','origin','main');
  if(!initialContent)await writeFile(path.join(root,'content.json'),JSON.stringify(fixture,null,2)+'\n');
  return {root,remote,dir,publisher:createPublisher(root,{checks})};
}
async function change(root, update) {
  const file=path.join(root,'content.json'); const data=JSON.parse(await readFile(file,'utf8'));update(data);await writeFile(file,JSON.stringify(data,null,2)+'\n');
}
test('自動產生依內容分類的 commit 訊息',()=>{
  const after=structuredClone(fixture);after.links[0].title='Changed';
  assert.equal(suggestMessage(fixture,after,false,0),'content: 更新連結與標題');
  assert.equal(suggestMessage(fixture,after,true,0),'feat: 更新連結頁與本機管理功能');
});
test('僅提交內容與使用中的圖片，保留程式修改及未引用檔案',async t=>{
  const {root,remote,publisher}=await setup(t);
  await mkdir(path.join(root,'public/uploads'),{recursive:true});
  await writeFile(path.join(root,'public/uploads/used.png'),'test');
  await writeFile(path.join(root,'public/uploads/unused.png'),'test');
  await writeFile(path.join(root,'App.tsx'),'source change');
  await writeFile(path.join(root,'.env'),'TEST_ONLY=not-a-secret');
  await change(root,data=>{data.links[0].imageUrl='/uploads/used.png';});
  const review=await publisher.review(false);
  assert.equal(review.canPublish,true);
  assert.deepEqual(review.files.map(file=>file.path).sort(),['content.json','public/uploads/used.png']);
  const result=await publisher.publish({reviewId:review.reviewId,includeCode:false,message:'content: 更新圖片 $(literal)'});
  assert.equal(result.status,'pushed');
  assert.equal(await git(root,'log','-1','--format=%s'),'content: 更新圖片 $(literal)');
  assert.equal(await git(remote,'rev-parse','refs/heads/main'),result.commit);
  assert.equal(await git(root,'diff','--cached','--name-only'),'');
  assert.match(await git(root,'status','--short'),/App.tsx/);
  await assert.rejects(git(root,'cat-file','-e','HEAD:.env'));
});
test('檢視後內容改變則拒絕提交，保留工作目錄',async t=>{
  const {root,publisher}=await setup(t);await change(root,data=>{data.profile.name='First';});
  const report=await publisher.review(false);const head=await git(root,'rev-parse','HEAD');
  await change(root,data=>{data.profile.name='Second';});
  await assert.rejects(publisher.publish({reviewId:report.reviewId,message:'content: test'}),/已改變/);
  assert.equal(await git(root,'rev-parse','HEAD'),head);
  assert.equal(await git(root,'diff','--cached','--name-only'),'');
});
test('已有暫存內容時拒絕操作且不改動暫存區',async t=>{
  const {root,publisher}=await setup(t);await writeFile(path.join(root,'notes.txt'),'keep staged');await git(root,'add','notes.txt');
  await change(root,data=>{data.profile.name='Changed';});
  const report=await publisher.review(false);assert.match(report.blocked,/暫存區/);
  await assert.rejects(publisher.publish({reviewId:report.reviewId,message:'test'}),/暫存區/);
  assert.equal(await git(root,'diff','--cached','--name-only'),'notes.txt');
});
test('首次更新要求包含程式，但仍排除環境檔與其他檔案',async t=>{
  const {root,publisher}=await setup(t,false);
  await writeFile(path.join(root,'App.tsx'),'first app');await writeFile(path.join(root,'.env'),'TEST_ONLY=fixture');
  const contentOnly=await publisher.review(false);assert.match(contentOnly.blocked,/首次/);
  const all=await publisher.review(true);assert.equal(all.canPublish,true);
  assert.ok(all.files.some(file=>file.path==='App.tsx'));assert.ok(!all.files.some(file=>file.path==='.env'));
});
test('遠端有新提交時拒絕推送，不自動合併或強制覆蓋',async t=>{
  const {root,remote,dir,publisher}=await setup(t);
  const other=path.join(dir,'other');await git(dir,'clone','--branch','main',remote,other);
  await git(other,'config','user.name','Other Test');await git(other,'config','user.email','other-test@example.com');
  await writeFile(path.join(other,'README.md'),'remote changed');await git(other,'add','.');await git(other,'commit','-m','remote update');await git(other,'push','origin','main');
  await change(root,data=>{data.profile.name='Local';});
  const report=await publisher.review(false);assert.match(report.blocked,/遠端/);
  await assert.rejects(publisher.publish({reviewId:report.reviewId,message:'test'}),/遠端/);
});
test('推送失敗保留 commit，重試只推送同一個 commit',async t=>{
  const {root,remote,publisher}=await setup(t);await change(root,data=>{data.profile.name='Changed';});
  const hook=path.join(remote,'hooks/pre-receive');await writeFile(hook,'#!/bin/sh\nexit 1\n');await chmod(hook,0o755);
  const review=await publisher.review(false);
  const first=await publisher.publish({reviewId:review.reviewId,message:'content: test'});
  assert.equal(first.status,'push-failed');assert.equal(await git(root,'diff','--cached','--name-only'),'');
  await unlink(hook);
  const retry=await publisher.review(false);assert.equal(retry.files.length,0);assert.equal(retry.pendingCommits.length,1);
  const second=await publisher.publish({reviewId:retry.reviewId,message:''});
  assert.equal(second.status,'pushed');assert.equal(second.commit,first.commit);
});
test('檢查失敗不建立 commit、不暫存檔案',async t=>{
  const {root,publisher}=await setup(t,true,async()=>{throw new Error('build failed');});
  await change(root,data=>{data.profile.name='Changed';});const head=await git(root,'rev-parse','HEAD');const review=await publisher.review(false);
  await assert.rejects(publisher.publish({reviewId:review.reviewId,message:'test'}),/build failed/);
  assert.equal(await git(root,'rev-parse','HEAD'),head);assert.equal(await git(root,'diff','--cached','--name-only'),'');
});
