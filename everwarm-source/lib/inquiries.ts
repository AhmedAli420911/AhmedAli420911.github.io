/** Browser-local inquiry model. No network or service integration. */
export const STORAGE_KEY = 'everwarm-inquiries-v2';
export const LEGACY_KEY = 'everwarm-demo-leads-v1';
export const statuses = ['New', 'Contacted', 'Estimate Scheduled', 'Estimate Completed', 'Won', 'Lost'];
export const sources = ['Website Form', 'After-Hours AI', 'Missed-Call Recovery', 'Manual Entry'];
export const requestTypes = ['Furnace Replacement', 'Furnace Repair', 'No Heat', 'Maintenance', 'Existing Appointment', 'Billing', 'Other'];
export const teams = ['Unassigned', 'Office team', 'Service team', 'Estimating team', 'Accounts team'];
export const callbackStatuses = ['Needed', 'Attempted', 'Completed', 'Not needed'];
export type Entry = { text: string; date: string };
export type Turn = { role: 'Caller' | 'Virtual assistant'; text: string };
export type Lead = {
 id: string; date: string; createdAt: string; updatedAt: string; name: string; phone: string; email: string; city: string;
 property: string; problem: string; age: string; contact: string; time: string; status: string; source: string; sample: boolean;
 requestType: string; urgency: string; assignedTeam: string; nextAction: string; callbackStatus: string; callSummary: string;
 transcript: Turn[]; disclosureStatus: string; customerType: string; additionalNotes: string; notes: Entry[]; activity: Entry[];
};
export const now = () => new Date().toISOString();
export const newId = () => 'EW-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const str = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const dateOr = (value: unknown, fallback: string) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
const choice = (value: unknown, options: string[], fallback: string) => typeof value === 'string' && options.includes(value) ? value : fallback;
const entries = (value: unknown, date: string): Entry[] => Array.isArray(value) ? value.filter(v => v && typeof v.text === 'string').map(v => ({text:v.text,date:dateOr(v.date,date)})) : [];
export function normalizeLead(raw: Partial<Lead> & Record<string, unknown>, timestamp = now()): Lead {
 const createdAt = dateOr(raw.createdAt, dateOr(raw.date, timestamp));
 const source = raw.source === 'Website Demo' ? 'Website Form' : choice(raw.source, sources, 'Website Form');
 const status = choice(raw.status, statuses, 'New');
 return {
  ...raw, id:str(raw.id)||newId(), date:createdAt, createdAt, updatedAt:dateOr(raw.updatedAt,createdAt),
  name:str(raw.name,'Unnamed test inquiry'), phone:str(raw.phone), email:str(raw.email), city:str(raw.city),
  property:str(raw.property,'Not specified'), problem:str(raw.problem), age:str(raw.age,'Not sure'), contact:choice(raw.contact,['Phone','Email','Text'],'Phone'), time:str(raw.time,'Not specified'),
  status, source, sample:raw.sample===true, requestType:choice(raw.requestType,requestTypes,'Furnace Replacement'),
  urgency:choice(raw.urgency,['Standard','Urgent'],'Standard'), assignedTeam:choice(raw.assignedTeam,teams,'Unassigned'),
  nextAction:str(raw.nextAction,'Review request and confirm the next step'), callbackStatus:choice(raw.callbackStatus,callbackStatuses,['Won','Lost'].includes(status)?'Not needed':'Needed'),
  callSummary:str(raw.callSummary,str(raw.problem)), transcript:Array.isArray(raw.transcript)?raw.transcript.filter(t=>t && ['Caller','Virtual assistant'].includes(t.role) && typeof t.text==='string'):[],
  disclosureStatus:str(raw.disclosureStatus,'Not recorded — legacy test record'), customerType:choice(raw.customerType,['New customer','Existing customer','Not specified'],'Not specified'),
  additionalNotes:str(raw.additionalNotes), notes:entries(raw.notes,createdAt), activity:entries(raw.activity,createdAt),
 };
}
export function migrateRecords(data: unknown): Lead[] {
 const list=Array.isArray(data)?data:(data && typeof data==='object' && 'version' in data && data.version===2 && 'leads' in data ? data.leads:null);
 if(!Array.isArray(list)) throw new Error('Saved records could not be read.');
 // Keep all object records, even if some optional fields were absent in v1.
 if(list.some(v=>!v || typeof v!=='object' || Array.isArray(v))) throw new Error('Saved records could not be read.');
 return list.map(v=>normalizeLead(v));
}
export const blankForm = () => ({name:'',phone:'',email:'',city:'',requestType:'Furnace Replacement',property:'Not specified',age:'Not sure',contact:'Phone',time:'Not specified',additionalNotes:''});
export function validateHomeowner(form: Record<string,string>, consent: boolean) {
 const errors:Record<string,string>={};
 for(const [key,label] of [['name','a full name'],['phone','a phone number'],['city','a city or postal code'],['requestType','the help you need']]) if(!form[key]?.trim()) errors[key]=`Please enter ${label}.`;
 if(form.phone && !/^\+?[\d\s().-]+$/.test(form.phone)) errors.phone='Use digits and standard phone-number punctuation.';
 if(form.phone && (form.phone.replace(/\D/g,'').length<10 || form.phone.replace(/\D/g,'').length>15)) errors.phone='Please enter a test phone number with 10–15 digits.';
 if(form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email='Please enter a valid test email, such as alex@example.com.';
 if(!requestTypes.includes(form.requestType)) errors.requestType='Please choose a service from the list.';
 if(form.contact==='Email' && !form.email?.trim()) errors.email='Enter a test email or choose Phone or Text as your contact method.';
 if(!consent) errors.consent='Please confirm that you will only enter fictional test information.';
 return errors;
}
export function createWebsiteInquiry(form: Record<string,string>, timestamp=now()):Lead {
 return normalizeLead({...form,id:newId(),name:form.name.trim(),email:form.email.trim(),city:form.city.trim(),problem:form.requestType,
  source:'Website Form',urgency:'Standard',status:'New',createdAt:timestamp,updatedAt:timestamp,
  assignedTeam:'Office team',nextAction:'Review request and contact the homeowner',callbackStatus:'Needed',
  disclosureStatus:'Fictional-test acknowledgement accepted',callSummary:`${form.requestType} requested in ${form.city.trim()}.${form.additionalNotes.trim()?' '+form.additionalNotes.trim():''}`,
  activity:[{text:'Website inquiry received',date:timestamp},{text:'Assigned to Office team; review task created',date:timestamp}],notes:[],transcript:[],sample:false},timestamp);
}
export const scenarios = [
 {id:'no-heat',label:'No heat after hours',requestType:'No Heat',urgency:'Urgent',name:'Alex Sample',phone:'416-555-0101',city:'Toronto',time:'As soon as the team is available',customerType:'New customer',reason:'The heat stopped this evening. I would like someone to call me back.',assignedTeam:'Service team',nextAction:'Prioritize a callback; confirm safety and service availability'},
 {id:'replacement',label:'Furnace replacement estimate',requestType:'Furnace Replacement',urgency:'Standard',name:'Jordan Example',phone:'416-555-0102',city:'Mississauga',time:'Tomorrow morning',customerType:'New customer',reason:'I am considering replacing an older furnace and would like an estimate.',assignedTeam:'Estimating team',nextAction:'Call to confirm replacement needs and assessment availability'},
 {id:'maintenance',label:'Maintenance request',requestType:'Maintenance',urgency:'Standard',name:'Taylor Demo',phone:'416-555-0103',city:'Vaughan',time:'Tomorrow afternoon',customerType:'Existing customer',reason:'I would like to ask about arranging furnace maintenance.',assignedTeam:'Service team',nextAction:'Call to discuss maintenance and available appointment options'},
 {id:'appointment',label:'Existing appointment question',requestType:'Existing Appointment',urgency:'Standard',name:'Morgan Fictional',phone:'416-555-0104',city:'Markham',time:'Tomorrow morning',customerType:'Existing customer',reason:'I have a question about an existing appointment and need the office to call me.',assignedTeam:'Office team',nextAction:'Verify the existing appointment with the caller and office records'},
];
export const urgentScript = 'I can collect this request for the team, but I cannot diagnose the equipment or guarantee emergency service. If you smell gas or believe there is an immediate danger, leave the property and contact emergency services or your local gas provider.';
export function scenarioTranscript(id:string):Turn[] {
 const s=scenarios.find(s=>s.id===id);if(!s)throw new Error('Choose an available scenario.');
 return [
  {role:'Virtual assistant',text:'Hi, you’ve reached EverWarm Home Comfort. I’m the virtual assistant. I can collect the reason for your call and arrange for the team to follow up. How can I help?'},
  {role:'Caller',text:s.reason},
  {role:'Virtual assistant',text:(s.urgency==='Urgent'?urgentScript+' ':'')+'May I confirm your name, callback number, and city or postal code?'},
  {role:'Caller',text:`My name is ${s.name}. My callback number is ${s.phone}, and I am in ${s.city}.`},
  {role:'Virtual assistant',text:`I’ve categorized this as ${s.requestType}, with ${s.urgency.toLowerCase()} priority. Are you a new or existing customer, and when is a good time for a callback?`},
  {role:'Caller',text:`I am a ${s.customerType.toLowerCase()}. ${s.time} works for a callback.`},
  {role:'Virtual assistant',text:`Thank you, ${s.name}. Your request is for the ${s.assignedTeam.toLowerCase()} to review. They need to confirm availability and next steps. No appointment or dispatch is confirmed.`},
 ];
}
export function createCallInquiry(scenarioId:string, source:string, timestamp=now()):Lead {
 const s=scenarios.find(s=>s.id===scenarioId);if(!s)throw new Error('Choose an available scenario.');
 if(!['After-Hours AI','Missed-Call Recovery'].includes(source))throw new Error('Choose a call source.');
 return normalizeLead({...s,id:newId(),source,createdAt:timestamp,updatedAt:timestamp,problem:s.reason,contact:'Phone',status:'New',sample:true,
  callbackStatus:'Needed',callSummary:`${s.name} in ${s.city}: ${s.reason} ${s.requestType}; urgency: ${s.urgency}. ${s.customerType}. Callback requested: ${s.time.toLowerCase()}. No appointment or dispatch confirmed.`,
  transcript:scenarioTranscript(scenarioId),disclosureStatus:'Virtual-assistant introduction shown in scripted simulation; no call recorded',
  activity:[{text:source==='Missed-Call Recovery'?'Unanswered-call callback request captured (simulated)':'After-hours inquiry captured (simulated)',date:timestamp},
   {text:`Categorized as ${s.requestType}; ${s.urgency}`,date:timestamp},{text:`Assigned to ${s.assignedTeam}`,date:timestamp},{text:'Staff notification simulated — nothing sent',date:timestamp}],notes:[]},timestamp);
}
export function createManualInquiry(form:Record<string,string>, timestamp=now()):Lead {
 const lead=createWebsiteInquiry(form,timestamp);
 return normalizeLead({...lead,source:'Manual Entry',urgency:form.urgency||'Standard',assignedTeam:form.assignedTeam||'Office team',
  customerType:form.customerType||'Not specified',nextAction:form.nextAction?.trim()||'Review staff entry and arrange a callback',
  disclosureStatus:'Fictional-test acknowledgement accepted by staff',activity:[{text:'Inquiry entered manually by staff',date:timestamp}]},timestamp);
}
export function seedLeads():Lead[]{
 const date=now(),website=createWebsiteInquiry({...blankForm(),name:'Jamie Example',phone:'416-555-0100',city:'Richmond Hill',additionalNotes:'Fictional sample: interested in replacing an older furnace.'},date);
 return [{...website,id:'EW-SAMPLE-WEB',sample:true},{...createCallInquiry('no-heat','After-Hours AI',date),id:'EW-SAMPLE-CALL'},{...createCallInquiry('maintenance','Missed-Call Recovery',date),id:'EW-SAMPLE-CALLBACK'}];
}
export function filterLeads(leads:Lead[],filters:{query?:string;source?:string;status?:string;urgency?:string}){
 const q=(filters.query||'').trim().toLowerCase();
 return leads.filter(l=>(!filters.source||filters.source==='All sources'||l.source===filters.source)&&(!filters.status||filters.status==='All statuses'||l.status===filters.status)&&(!filters.urgency||filters.urgency==='All urgency'||l.urgency===filters.urgency)&&[l.id,l.name,l.city,l.phone,l.email,l.requestType,l.source,l.callSummary,l.nextAction].join(' ').toLowerCase().includes(q));
}
export function updateInquiry(lead:Lead, patch:Partial<Lead>, activityText:string, timestamp=now()):Lead{
 return {...lead,...patch,id:lead.id,createdAt:lead.createdAt,date:lead.createdAt,updatedAt:timestamp,activity:[...lead.activity,{text:activityText,date:timestamp}]};
}
export function loadInquiries(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>){
 const v2=storage.getItem(STORAGE_KEY),legacy=v2===null?storage.getItem(LEGACY_KEY):null;
 const leads=v2!==null?migrateRecords(JSON.parse(v2)):legacy!==null?migrateRecords(JSON.parse(legacy)):seedLeads();
 // The original key remains intact unless the user explicitly resets the demo.
 let writable=true;try{storage.setItem(STORAGE_KEY,JSON.stringify({version:2,leads}));}catch{writable=false;}
 return {leads,writable,migrated:legacy!==null};
}
export function persistInquiries(storage:Pick<Storage,'setItem'>,leads:Lead[]){storage.setItem(STORAGE_KEY,JSON.stringify({version:2,leads}));}
