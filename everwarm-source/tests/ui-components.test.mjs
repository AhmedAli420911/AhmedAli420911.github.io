import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const source=await readFile(new URL('../lib/inquiries.ts',import.meta.url),'utf8');
const {code}=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const timestamp='2026-09-08T12:00:00.000Z';
const valid=()=>({...m.blankForm(),name:'Sam Example',phone:'416-555-0109',city:'Toronto'});
function storage(initial={}){const data=new Map(Object.entries(initial));return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}

test('homeowner validation requires name, phone, location, selected service, and test acknowledgement',()=>{
 for(const key of ['name','phone','city','requestType']){const f=valid();f[key]='';assert.ok(m.validateHomeowner(f,true)[key],key);}
 assert.ok(m.validateHomeowner(valid(),false).consent);
 assert.deepEqual(m.validateHomeowner(valid(),true),{});
});
test('email is optional, validated if provided, and necessary only when Email contact is chosen',()=>{
 assert.deepEqual(m.validateHomeowner(valid(),true),{});
 assert.ok(m.validateHomeowner({...valid(),email:'bad'},true).email);
 assert.ok(m.validateHomeowner({...valid(),contact:'Email'},true).email);
 assert.deepEqual(m.validateHomeowner({...valid(),contact:'Email',email:'sam@example.com'},true),{});
});
test('invalid phone and unsupported service are rejected',()=>{
 assert.ok(m.validateHomeowner({...valid(),phone:'123'},true).phone);
 assert.ok(m.validateHomeowner({...valid(),phone:'not-a-number12345'},true).phone);
 assert.ok(m.validateHomeowner({...valid(),requestType:'Unsupported'},true).requestType);
});
test('website requests have the selected service, Website Form source, Standard urgency, and New status',()=>{
 const l=m.createWebsiteInquiry({...valid(),requestType:'Maintenance',additionalNotes:'Test-only note'},timestamp);
 assert.equal(l.source,'Website Form');assert.equal(l.urgency,'Standard');assert.equal(l.status,'New');assert.equal(l.requestType,'Maintenance');
 assert.equal(l.createdAt,timestamp);assert.equal(l.updatedAt,timestamp);assert.equal(l.additionalNotes,'Test-only note');assert.equal(l.email,'');assert.match(l.disclosureStatus,/acknowledgement accepted/);
});
test('inquiry IDs are unique and contain no supplied personal fields',()=>{
 const ids=new Set(Array.from({length:100},()=>m.createWebsiteInquiry(valid()).id));assert.equal(ids.size,100);
 for(const id of ids)assert.match(id,/^EW-[0-9A-F]{16}$/);
});
test('all four scenarios create complete call records for either capture source',()=>{
 for(const scenario of m.scenarios) for(const source of ['After-Hours AI','Missed-Call Recovery']){
  const l=m.createCallInquiry(scenario.id,source,timestamp);
  assert.equal(l.source,source);assert.equal(l.requestType,scenario.requestType);assert.equal(l.urgency,scenario.urgency);
  assert.equal(l.name,scenario.name);assert.equal(l.status,'New');assert.equal(l.callbackStatus,'Needed');assert.equal(l.sample,true);
  assert.equal(l.transcript.length,7);assert.ok(l.callSummary);assert.ok(l.assignedTeam);assert.ok(l.nextAction);assert.ok(l.disclosureStatus);
  assert.equal(l.createdAt,timestamp);assert.match(l.activity.at(-1).text,/nothing sent/);
 }
});
test('urgent scenario includes safety limits and no simulated dispatch promise',()=>{
 const transcript=m.scenarioTranscript('no-heat').map(t=>t.text).join(' ');
 assert.ok(transcript.includes(m.urgentScript));assert.match(transcript,/No appointment or dispatch is confirmed/);
 assert.throws(()=>m.createCallInquiry('missing','After-Hours AI'));
 assert.throws(()=>m.createCallInquiry('no-heat','Website Form'));
});
test('manual entries keep routing choices and use the Manual Entry source',()=>{
 const l=m.createManualInquiry({...valid(),requestType:'Billing',urgency:'Standard',assignedTeam:'Accounts team',nextAction:'Review a fictional invoice',customerType:'Existing customer'},timestamp);
 assert.equal(l.source,'Manual Entry');assert.equal(l.assignedTeam,'Accounts team');assert.equal(l.nextAction,'Review a fictional invoice');assert.equal(l.customerType,'Existing customer');
});
test('legacy migration retains identity, name, notes, status and activity while adding safe defaults',()=>{
 const old={id:'EW-OLD-001',date:timestamp,name:'Legacy Example',status:'Contacted',source:'Website Demo',problem:'Old heating description',notes:[{text:'Keep this note',date:timestamp}],activity:[{text:'Inquiry received',date:timestamp}]};
 const [l]=m.migrateRecords([old]);
 assert.equal(l.id,old.id);assert.equal(l.name,old.name);assert.deepEqual(l.notes,old.notes);assert.deepEqual(l.activity,old.activity);assert.equal(l.status,'Contacted');
 assert.equal(l.source,'Website Form');assert.equal(l.urgency,'Standard');assert.equal(l.requestType,'Furnace Replacement');assert.equal(l.createdAt,timestamp);assert.equal(l.updatedAt,timestamp);assert.equal(l.callSummary,old.problem);assert.deepEqual(l.transcript,[]);assert.match(l.disclosureStatus,/Not recorded/);
});
test('partial records are normalized safely; malformed containers are rejected without mutation',()=>{
 const [l]=m.migrateRecords([{id:'legacy-partial',name:'Partial Example',notes:null,activity:null,date:'bad date',urgency:'invalid',source:'old source',status:'invalid'}]);
 assert.equal(l.id,'legacy-partial');assert.equal(l.urgency,'Standard');assert.equal(l.source,'Website Form');assert.equal(l.status,'New');assert.deepEqual(l.notes,[]);assert.deepEqual(l.activity,[]);assert.ok(!Number.isNaN(Date.parse(l.createdAt)));
 assert.throws(()=>m.migrateRecords({version:3,leads:[]}));assert.throws(()=>m.migrateRecords([null]));
});
test('versioned migration writes v2 once and leaves original legacy data untouched',()=>{
 const legacy=JSON.stringify([{id:'old-1',name:'Stored Example',date:timestamp,status:'Won',notes:[{text:'Saved',date:timestamp}]}]);
 const s=storage({[m.LEGACY_KEY]:legacy});const first=m.loadInquiries(s);assert.equal(first.migrated,true);assert.equal(first.leads[0].id,'old-1');assert.equal(s.getItem(m.LEGACY_KEY),legacy);
 const second=m.loadInquiries(s);assert.equal(second.migrated,false);assert.deepEqual(second.leads,first.leads);assert.equal(JSON.parse(s.getItem(m.STORAGE_KEY)).version,2);
});
test('blocked writes preserve loaded records in memory',()=>{
 const s=storage({[m.LEGACY_KEY]:JSON.stringify([{id:'readable-old',name:'Keep Me'}])});s.setItem=()=>{throw new Error('quota');};
 const loaded=m.loadInquiries(s);assert.equal(loaded.writable,false);assert.equal(loaded.leads[0].id,'readable-old');
});
test('corrupt saved data is not overwritten while loading',()=>{
 const s=storage({[m.STORAGE_KEY]:'{invalid'});assert.throws(()=>m.loadInquiries(s));assert.equal(s.getItem(m.STORAGE_KEY),'{invalid');
});
test('source, status, urgency and search filters combine correctly',()=>{
 const leads=m.seedLeads();assert.equal(m.filterLeads(leads,{source:'After-Hours AI',urgency:'Urgent',status:'New',query:' toronto '}).length,1);
 assert.equal(m.filterLeads(leads,{source:'Website Form',urgency:'Urgent'}).length,0);
 assert.equal(m.filterLeads(leads,{source:'Missed-Call Recovery'})[0].source,'Missed-Call Recovery');
 assert.equal(m.filterLeads(leads,{query:'nonexistent'}).length,0);
 assert.equal(m.filterLeads(leads,{source:'All sources',status:'All statuses',urgency:'All urgency'}).length,3);
});
test('status and note changes update timestamps and survive save / reload',()=>{
 const original=m.createWebsiteInquiry(valid(),timestamp),later='2026-09-08T13:00:00.000Z';
 const updated=m.updateInquiry(original,{status:'Contacted',notes:[{text:'Saved test note',date:later}]},'Staff contacted caller',later);
 assert.equal(updated.createdAt,timestamp);assert.equal(updated.updatedAt,later);assert.equal(updated.activity.at(-1).text,'Staff contacted caller');
 const s=storage();m.persistInquiries(s,[updated]);assert.deepEqual(m.loadInquiries(s).leads,[updated]);
});
test('an empty saved tracker stays empty; reset seeds cover all three requested channels',()=>{
 const s=storage();m.persistInquiries(s,[]);assert.deepEqual(m.loadInquiries(s).leads,[]);
 const seeds=m.seedLeads();assert.deepEqual(seeds.map(l=>l.source),['Website Form','After-Hours AI','Missed-Call Recovery']);assert.ok(seeds.every(l=>l.sample));
 m.persistInquiries(s,seeds);assert.equal(m.loadInquiries(s).leads.length,3);
});
