import assert from 'node:assert/strict';
import test from 'node:test';
const workerUrl=new URL('../dist/server/index.js',import.meta.url);
workerUrl.searchParams.set('test',`${process.pid}-${Date.now()}`);
const {default:worker}=await import(workerUrl.href);
let html;
test('built EverWarm page responds with the preserved homeowner design and business-workflow entry',async()=>{
 const response=await worker.fetch(new Request('http://localhost/',{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/^text\/html/);html=await response.text();
 assert.match(html,/HVAC Inquiry Capture System/);assert.match(html,/Furnace problems/);assert.match(html,/View Business Workflow/);assert.match(html,/href="#system-demo"/);assert.match(html,/Calling after hours/);assert.match(html,/src="\/hero.webp"/);
 assert.doesNotMatch(html,/Starter Project|codex-preview|Ship something real/);
});
test('rendered homeowner form has required intake controls and optional email',()=>{
 assert.match(html,/<input[^>]*id="home-name"[^>]*required/);
 assert.match(html,/<input[^>]*id="home-phone"[^>]*required/);
 assert.match(html,/<input[^>]*id="home-city"[^>]*required/);
 const email=html.match(/<input[^>]*id="home-email"[^>]*>/)?.[0];assert.ok(email);assert.doesNotMatch(email,/\srequired(?:=|\s|>)/);
 assert.match(html,/What help do you need/);assert.match(html,/Additional details/);assert.match(html,/Enter test information only/);assert.match(html,/aria-required="true"/);
 assert.doesNotMatch(html,/href="tel:|href="mailto:/);
});
