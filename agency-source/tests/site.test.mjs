import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const moduleText = ts.transpileModule(await readFile('components/service-capture/requests.ts','utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const {validateRequest, submitRequest, safeWebUrl, emptyRequest, requestSchema} = await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const valid = {...emptyRequest, fullName:'Fictional Owner',email:'owner@example.com',company:'Test HVAC',problem:'Calls may arrive while the office is busy.',consent:true};
test('required fields and consent produce individual errors', () => {
  assert.deepEqual(Object.keys(validateRequest(emptyRequest)).sort(), ['fullName','email','company','problem','consent'].sort());
});
test('the five-field request is valid without review-only details', () => assert.deepEqual(validateRequest(valid),{}));
test('invalid email and overlong message are rejected', () => {
  const errors = validateRequest({...valid,email:'invalid',problem:'a'.repeat(3001)});
  assert.deepEqual(Object.keys(errors).sort(),['email','problem'].sort());
});
test('unsafe configuration URLs are rejected', () => {
  for(const value of ['javascript:alert(1)','data:text/html,test','http://example.com','//example.com','https://user:pass@example.com','/\\evil.com']) assert.equal(safeWebUrl(value,true),'');
  assert.equal(safeWebUrl('/api/review',true),'/api/review');
  assert.equal(safeWebUrl('https://example.com/review'),'https://example.com/review');
});
test('unconfigured endpoint never makes a request or reports success',async () => {
  let called=false;
  await assert.rejects(submitRequest(valid,'',async()=>{called=true;}),/not connected yet.*not been sent/);
  assert.equal(called,false);
});
test('invalid submissions never reach the configured transport',async () => {
  let called=false;
  await assert.rejects(submitRequest({...valid,consent:false},'/api/review',async()=>{called=true;}),/required fields/);
  assert.equal(called,false);
});
test('server-confirmed acceptance sends JSON with consent and no credentials',async () => {
  let sent;
  await submitRequest(valid,'/api/review',async(url,options)=>{sent={url,...options};return new Response(JSON.stringify({accepted:true}),{status:200});});
  assert.equal(sent.url,'/api/review');assert.equal(sent.method,'POST');assert.equal(sent.credentials,'omit');assert.equal(sent.redirect,'error');
  const body=JSON.parse(sent.body);assert.equal(body.consent,true);assert.match(body.consentText,/may contact me/);assert.equal(body.problem,valid.problem);assert.deepEqual(Object.keys(body).sort(),['fullName','email','company','problem','service','consent','consentText','hp'].sort());assert.equal(body.hp,'');
});
test('the honeypot value is forwarded so the server can drop automated submissions',async()=>{
  let body;
  await submitRequest(valid,'/api/review',async(url,options)=>{body=JSON.parse(options.body);return new Response('{"accepted":true}');},'filled-by-bot');
  assert.equal(body.hp,'filled-by-bot');
});
test('the default contract still rejects a provider-shaped acknowledgement',async()=>{
  await assert.rejects(submitRequest(valid,'/api/review',async()=>new Response('{"success":true}',{status:200})),/did not confirm receipt/);
});
test('HTTP failures cannot report acceptance',async()=>{
  for(const status of [400,429,500]) await assert.rejects(submitRequest(valid,'/api/review',async()=>new Response(JSON.stringify({accepted:true}),{status})),/could not be confirmed/);
});
test('empty, HTML and unacknowledged success responses fail honestly',async()=>{
  for(const body of ['', '<html>OK</html>', '{}', '{"accepted":false}', '{"accepted":"true"}']) await assert.rejects(submitRequest(valid,'/api/review',async()=>new Response(body,{status:200})),/confirm receipt|did not confirm receipt/);
});
test('network and timeout failures return useful messages',async()=>{
  await assert.rejects(submitRequest(valid,'/api/review',async()=>{throw new TypeError('Failed to fetch');}),/check your connection/);
  await assert.rejects(submitRequest(valid,'/api/review',async()=>{throw new DOMException('Aborted','AbortError');}),/timed out.*could not be confirmed/);
});
const routes=['index.html','services/index.html','interactive-demo/index.html','privacy/index.html','terms/index.html','accessibility/index.html','404.html'];
test('every rendered navigation link and anchor resolves',async()=>{
  for(const route of routes){
    const html=await readFile(`out/production/${route}`,'utf8');
    for(const [,href] of html.matchAll(/<a[^>]+href="([^"]*)"/g)){
      assert.ok(href,`Empty link in ${route}`);
      if(/^(https:|mailto:|tel:)/.test(href)) continue;
      const [pathname,hash]=href.split('#');
      const target=pathname ? (pathname === '/' ? 'index.html' : pathname.replace(/^\//,'')+'index.html') : route;
      await access(`out/production/${target}`);
      if (pathname === '/demo/') {assert.equal(hash,'system-demo'); continue;}
      if(hash){const text=await readFile(`out/production/${target}`,'utf8');assert.ok(text.includes(`id="${hash}"`),`${href} has missing anchor`);}
    }
  }
});
test('metadata, semantic pages, labels and honest defaults are present',async()=>{
  for(const route of routes){
    const html=await readFile(`out/production/${route}`,'utf8');
    assert.equal([...html.matchAll(/<h1[ >]/g)].length,1);assert.match(html,/<main id="main-content"/);
    assert.doesNotMatch(html,/href="(?:mailto:|tel:)"|href="#"|googletagmanager|google-analytics|facebook\.net|gtag\(/);
    if(!['index.html','services/index.html'].includes(route)) assert.doesNotMatch(html,/application\/ld\+json/);
  }
  const home=await readFile('out/production/index.html','utf8');
  assert.match(home,/<title>HVAC Websites and Inquiry Systems \| Service Capture Co\.<\/title>/);
  assert.match(home,/CAD.*?\$2,500/);assert.match(home,/fictional HVAC company/);
  for(const field of Object.keys(emptyRequest).filter(key=>key!=='consent')) assert.match(home,new RegExp(`(?:for|id)="${field}"`));
  assert.doesNotMatch(home,/Request received\./);
});
test('legal pages are honest about review status',async()=>{
  assert.match(await readFile('out/production/privacy/index.html','utf8'),/has not been reviewed by a lawyer/);
  for(const route of ['terms','accessibility']) assert.match(await readFile(`out/production/${route}/index.html`,'utf8'),/Professional review pending/);
});
test('privacy page names the real providers, contact and retention practice',async()=>{
  const html=await readFile('out/production/privacy/index.html','utf8');
  for(const text of ['Cloudflare','Resend','Google Workspace','privacy@servicecaptureco.com','until you ask us to delete them','does not use analytics'])assert.ok(html.includes(text),text);
});
const origin='https://servicecaptureco.com';
const pagePaths={'index.html':'/','services/index.html':'/services/','interactive-demo/index.html':'/interactive-demo/','privacy/index.html':'/privacy/','terms/index.html':'/terms/','accessibility/index.html':'/accessibility/'};
test('indexable pages declare the canonical origin and Open Graph URL',async()=>{
  for(const [route,pathname] of Object.entries(pagePaths)){
    const html=await readFile(`out/production/${route}`,'utf8');
    assert.ok(html.includes(`<link rel="canonical" href="${origin}${pathname}">`),route);
    assert.ok(html.includes(`<meta property="og:url" content="${origin}${pathname}">`),route);
  }
  const notFound=await readFile('out/production/404.html','utf8');
  assert.match(notFound,/<meta name="robots" content="noindex">/);assert.doesNotMatch(notFound,/rel="canonical"/);
});
test('structured data holds only supplied business facts',async()=>{
  const html=await readFile('out/production/index.html','utf8');
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.deepEqual(Object.keys(data).sort(),['@context','@type','name','url','description','email','telephone','potentialAction','hasOfferCatalog'].sort());
  assert.equal(data.url,`${origin}/`);assert.equal(data.email,'hello@servicecaptureco.com');assert.equal(data.telephone,'+1 647-510-1465');
  assert.deepEqual(data.potentialAction,{'@type':'ReserveAction',name:'Book a 20-Minute Review',target:calendarUrl});
  assert.doesNotMatch(JSON.stringify(data),/address|streetAddress|postalCode/i);
});
const calendarUrl=(await readFile('config/site.ts','utf8')).match(/calendarUrl:\s*"([^"]*)"/)[1];
const bookingLinks=html=>[...html.matchAll(/<a([^>]*href="https:\/\/calendar\.app\.google\/[^"]*"[^>]*)>([^<]*)/g)].map(([,attrs,label])=>({attrs,label:label.trim()}));
test('the configured booking page is a safe public Google Calendar link',()=>{
  assert.match(calendarUrl,/^https:\/\/calendar\.app\.google\/[A-Za-z0-9]+$/);
  assert.equal(safeWebUrl(calendarUrl),calendarUrl);
});
test('every booking CTA opens the Google Calendar booking page in a new tab safely',async()=>{
  const expected={'index.html':4,'services/index.html':7,'interactive-demo/index.html':2,'privacy/index.html':1,'terms/index.html':1,'accessibility/index.html':1,'404.html':1};
  for(const [route,count] of Object.entries(expected)){
    const links=bookingLinks(await readFile(`out/production/${route}`,'utf8'));
    assert.equal(links.length,count,route);
    for(const {attrs,label} of links){
      assert.ok(attrs.includes(`href="${calendarUrl}"`),`${route}: ${attrs}`);
      assert.match(attrs,/target="_blank"/);assert.match(attrs,/rel="noopener noreferrer"/);
      assert.ok(attrs.includes(`aria-label="${label} (opens the Google Calendar booking page in a new tab)"`),`${route}: ${attrs}`);
    }
  }
});
test('booking CTAs use context-specific wording and only the one configured calendar link',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  const services=await readFile('out/production/services/index.html','utf8');
  assert.deepEqual(bookingLinks(home).map(link=>link.label),['Book a 20-Minute Review','Book a 20-Minute Review','Book a System Review','Book a 20-Minute Review']);
  assert.deepEqual(bookingLinks(services).map(link=>link.label),['Book a 20-Minute Review','Book a 20-Minute Review','Review My Website','Review My Website','Book a System Review','Discuss a Workflow','Book a 20-Minute Review']);
  for(const route of routes){
    const html=await readFile(`out/production/${route}`,'utf8');
    const hrefs=new Set([...html.matchAll(/href="(https:\/\/calendar[^"]*)"/g)].map(match=>match[1]));
    assert.deepEqual([...hrefs],hrefs.size?[calendarUrl]:[],route);
  }
});
test('booking CTAs sit in the header, hero, pricing, contact and demo closing sections',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  const sections=[/<header[\s\S]*?<\/header>/,/class="hero-actions"[\s\S]*?<\/div>/,/id="pricing"[\s\S]*?<\/section>/,/class="booking-cta"[\s\S]*?<\/div>/];
  for(const pattern of sections){const block=home.match(pattern);assert.ok(block,String(pattern));assert.equal(bookingLinks(block[0]).length,1,String(pattern));}
  const demo=await readFile('out/production/interactive-demo/index.html','utf8');
  assert.equal(bookingLinks(demo.match(/<header[\s\S]*?<\/header>/)[0]).length,1);
  assert.equal(bookingLinks(demo.slice(demo.indexOf('</header>'))).length,1);
});
test('the inquiry form stays reachable and separate from the booking page',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  assert.match(home,/<a class="text-link light" href="\/#contact">Or send a System Review request/);
  assert.match(home,/id="contact"[\s\S]*?<form/);
  const form=home.match(/<form[\s\S]*?<\/form>/)[0];
  assert.doesNotMatch(form,/calendar\.app\.google/);
  assert.doesNotMatch(home,/limited spots|only \d+ (?:spots|slots) left|book now before|act fast|expires? (?:today|soon)/i);
});
test('robots.txt and sitemap.xml point at the canonical origin',async()=>{
  assert.match(await readFile('out/production/robots.txt','utf8'),new RegExp(`Sitemap: ${origin}/sitemap.xml`));
  const sitemap=await readFile('out/production/sitemap.xml','utf8');
  for(const pathname of Object.values(pagePaths))assert.ok(sitemap.includes(`<loc>${origin}${pathname}</loc>`),pathname);
  assert.doesNotMatch(sitemap,/404|\/demo\//);
});
test('public contact details are exactly the supplied ones and the private mailbox never ships',async()=>{
  const files=[...routes.map(route=>`out/production/${route}`),'out/production/assets/site.js'];
  for(const file of files){
    const text=await readFile(file,'utf8');
    assert.doesNotMatch(text,/ahmedali@|(?<![A-Za-z0-9_$])re_[A-Za-z0-9]{8,}_?[A-Za-z0-9_]{8,}|api\.resend\.com/,file);
    for(const [,href] of text.matchAll(/href="(mailto:[^"]+|tel:[^"]+)"/g)) assert.ok(['mailto:hello@servicecaptureco.com','mailto:privacy@servicecaptureco.com','tel:+16475101465'].includes(href),`${file}: ${href}`);
    if(file.endsWith('.html')) assert.doesNotMatch(text,/packaged preview|once it is connected|before public launch|not connected yet\. Your request/i,file);
  }
});
test('server-provided short error messages reach the visitor',async()=>{
  await assert.rejects(submitRequest(valid,'/api/review',async()=>new Response(JSON.stringify({accepted:false,error:'Too many requests. Please wait a minute and try again.'}),{status:429})),/Too many requests/);
});
test('standalone embeds the identical EverWarm demo and no external asset files',async()=>{
  const html=await readFile('out/Service-Capture-Co-Preview.html','utf8');
  const encoded=html.match(/id="everwarm-data" type="application\/octet-stream">([^<]+)</)[1];
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(Buffer.from(encoded,'base64')),hash(await readFile('public/demo/index.html')));
  assert.equal(hash(await readFile('out/production/demo/index.html')),hash(await readFile('public/demo/index.html')));
  assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+rel="stylesheet"/);
  assert.match(html,/href="#\/privacy"/);
});
test('portable browser bundle has valid syntax and no unresolved Node globals',async()=>{
  const js=await readFile('out/preview-assets/site.js','utf8');new vm.Script(js);
  assert.doesNotMatch(js,/process\.env\.NODE_ENV/);
});

test('form and preparation schema contain only the short first-contact fields',async()=>{
  assert.deepEqual(Object.keys(emptyRequest).sort(),['fullName','email','company','problem','service','consent'].sort());
  assert.deepEqual(Object.keys(requestSchema.properties).sort(),['fullName','email','company','problem','service'].sort());
  assert.equal(requestSchema.additionalProperties,false);
  const html=await readFile('out/production/index.html','utf8');
  const form=html.match(/<form[\s\S]*?<\/form>/)[0];
  const fields=[...form.matchAll(/<(?:input|textarea|select)[^>]+name="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(fields,['fullName','email','company','service','problem','consent','hp']);
  assert.match(form,/class="hp-field" aria-hidden="true"/);assert.match(form,/name="hp"[^>]*tabindex="-1"|tabindex="-1"[^>]*name="hp"/i);
  for(const field of ['website','phone','region','volume','software']) assert.doesNotMatch(form,new RegExp(`name="${field}"`));
});
test('payload omits stale removed fields even when supplied by an older caller',async()=>{
  let body;
  await submitRequest({...valid,website:'https://example.com',phone:'5551234567',region:'Ontario',volume:'11–25',software:'Old CRM'},'/api/review',async(url,options)=>{body=JSON.parse(options.body);return new Response('{"accepted":true}');});
  assert.deepEqual(Object.keys(body).sort(),['fullName','email','company','problem','service','consent','consentText','hp'].sort());
});
test('all primary hosted demo CTAs open the business workflow safely',async()=>{
  for(const route of ['index.html','interactive-demo/index.html']) {
    const html=await readFile(`out/production/${route}`,'utf8');
    const demoLinks=[...html.matchAll(/<a([^>]+)>Open the EverWarm Demo/g)];
    assert.ok(demoLinks.length>0);
    for(const [,attrs] of demoLinks){assert.match(attrs,/href="\/demo\/#system-demo"/);assert.match(attrs,/target="_blank"/);assert.match(attrs,/rel="noopener noreferrer"/);}
  }
});
test('portable demo opener appends the workflow hash to an unchanged blob',async()=>{
  const source=await readFile('preview-entry.tsx','utf8');
  const openDemo=source.slice(source.indexOf('function openDemo()'),source.indexOf('function Preview()'));
  let opened;let blob;
  const context={document:{getElementById:()=>({textContent:Buffer.from('UNCHANGED DEMO').toString('base64')})},atob:value=>Buffer.from(value,'base64').toString('binary'),Uint8Array,Blob,URL:{createObjectURL:value=>{blob=value;return 'blob:test-demo';}},window:{open:(...args)=>{opened=args;}}};
  vm.runInNewContext(`let demoBlob='';${openDemo};openDemo();`,context);
  assert.equal(await blob.text(),'UNCHANGED DEMO');
  assert.equal(opened[0],'blob:test-demo#system-demo');assert.equal(opened[1],'_blank');assert.equal(opened[2],'noopener,noreferrer');
});
test('all agency font-size declarations meet the 12px floor',async()=>{
  const css=await readFile('app/globals.css','utf8');
  for(const match of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g))assert.ok(Number(match[1])>=12,match[0]);
});
test('scope, support limits and pricing FAQs are rendered',async()=>{
  const html=await readFile('out/production/index.html','utf8');
  for(const text of ['What the CAD $2,500 implementation includes','Up to six inquiry categories','Notifications for up to three staff recipients','Up to ten scripted test scenarios','Two revision rounds before launch','Fixing implementation problems','Minor notification changes','Continued management after the 30-day period','Are software and phone charges included?'])assert.ok(html.includes(text),text);
});
test('EverWarm public copy retains the supplied archive checksum',async()=>{
  assert.equal(createHash('sha256').update(await readFile('public/demo/index.html')).digest('hex'),'beb3ce38181426458a36a27fcc60af9604c44dc015ca0e71f7e68e4f0bc6acc8');
});

// --- Services page --------------------------------------------------------
const servicesHtml=await readFile('out/production/services/index.html','utf8');
const priceTable=[['HVAC Website Launch','Starting at CAD $999','One-time build'],['Website Growth &amp; Care','CAD $250','Per month · optional ongoing support'],['HVAC Inquiry Capture System','CAD $2,500','One-time implementation'],['Custom Workflow Automation','Custom quote','After a workflow review']];
test('the services page advertises the four services with their exact prices',()=>{
  for(const [name,price,note] of priceTable){
    assert.ok(servicesHtml.includes(name),name);
    assert.ok(servicesHtml.includes(price),`${name}: ${price}`);
    assert.ok(servicesHtml.includes(note),`${name}: ${note}`);
  }
  assert.equal([...servicesHtml.matchAll(/class="service-block" id="/g)].length,4);
  for(const id of ['website-launch','growth-care','inquiry-capture','workflow-automation']) assert.ok(servicesHtml.includes(`id="${id}"`),id);
  assert.ok(servicesHtml.includes('Most Complete'));
  assert.match(servicesHtml,/<title>HVAC Websites, Inquiry Systems and Automation \| Service Capture Co\.<\/title>/);
});
test('the services page states what each service excludes and who it is for',()=>{
  for(const text of ['What’s included','Not included','Who it’s for','Custom branding or logo design','Unused editing time (it does not accumulate)','Continued management after the 30-day period','Software subscriptions and usage fees','These items are not part of the starting package and require a separate quote.','Unused editing time does not carry over to the next month.','Final scope follows the System Review.','Not every task can or should be automated.'])assert.ok(servicesHtml.includes(text),text);
  assert.equal([...servicesHtml.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)].length,1);
  for(const row of ['Homeowners can’t easily find or understand your services online','Inquiries arrive but follow-up is scattered or delayed','One repetitive admin task doesn’t fit the packages above'])assert.ok(servicesHtml.includes(row),row);
  assert.ok(servicesHtml.includes('All prices are in Canadian dollars.'));
  assert.equal([...servicesHtml.matchAll(/<details>/g)].length,8);
});
test('every advertised price is in CAD and matches the price shown on the homepage',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  for(const html of [home,servicesHtml]){
    for(const [,amount] of html.matchAll(/\$(\d{1,3}(?:,\d{3})*)/g)) assert.ok(['999','250','2,500'].includes(amount),`unexpected price $${amount}`);
    for(const [,before] of html.matchAll(/(.{0,45})\$\d{1,3}(?:,\d{3})*/g)) assert.match(before,/CAD(?:<\/span>)?\s*$|CAD\b[^$]{0,12}$/,`price without CAD: ${before.slice(-45)}`);
  }
  assert.ok(home.includes('Starting at CAD $999'));
  assert.ok(home.includes('Website Growth &amp; Care, CAD $250 per month.'));
});
test('the homepage keeps the flagship prominent and links to the services page',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  const ways=home.match(/id="ways-we-can-help"[\s\S]*?<\/section>/)[0];
  for(const name of ['HVAC Website Launch','HVAC Inquiry Capture System','Custom Workflow Automation'])assert.ok(ways.includes(name),name);
  assert.equal([...ways.matchAll(/class="way-card"/g)].length,3);
  assert.ok(ways.includes('Explore Services'));
  assert.ok(ways.includes('Website Growth &amp; Care, CAD $250 per month.'));
  assert.match(home,/id="pricing"[\s\S]*?HVAC Inquiry Capture System[\s\S]*?CAD<\/span> \$2,500/);
  assert.ok([...home.matchAll(/href="\/services\/(?:#[a-z-]+)?"/g)].length>=5);
  assert.match(home,/Websites and inquiry systems built for/);
  assert.match(home,/helps HVAC businesses improve how customers find them, request service and move through the inquiry process/);
});
test('Services appears in the main and mobile navigation without losing existing links',async()=>{
  for(const route of routes){
    const html=await readFile(`out/production/${route}`,'utf8');
    const nav=html.match(/<nav id="main-navigation"[\s\S]*?<\/nav>/)[0];
    for(const label of ['Services','Interactive Demo','Pricing','FAQ'])assert.ok(nav.includes(`>${label}</a>`),`${route}: ${label}`);
    assert.ok(nav.includes('href="/services/"'),route);
    assert.match(html,/class="menu-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="main-navigation"/,route);
    const footer=html.match(/<footer[\s\S]*?<\/footer>/)[0];
    for(const label of ['Services','Privacy','Terms','Accessibility','Contact'])assert.ok(footer.includes(`>${label}</a>`),`${route} footer: ${label}`);
  }
});
test('the demo pathway and EverWarm labelling are unchanged by the services work',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  assert.ok(home.includes('fictional HVAC company'));
  assert.ok(!servicesHtml.includes('EverWarm'));
  for(const route of ['index.html','interactive-demo/index.html']){
    const html=await readFile(`out/production/${route}`,'utf8');
    for(const [,attrs] of html.matchAll(/<a([^>]+)>Open the EverWarm Demo/g)){assert.match(attrs,/href="\/demo\/#system-demo"/);assert.match(attrs,/rel="noopener noreferrer"/);}
  }
});
test('services structured data lists accurate CAD offers and no invented facts',()=>{
  const data=JSON.parse(servicesHtml.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(data.hasOfferCatalog['@type'],'OfferCatalog');
  const offers=data.hasOfferCatalog.itemListElement;
  assert.equal(offers.length,4);
  assert.deepEqual(offers.map(offer=>offer.name),['HVAC Website Launch','Website Growth & Care','HVAC Inquiry Capture System','Custom Workflow Automation']);
  assert.deepEqual(offers[0].priceSpecification,{'@type':'PriceSpecification',priceCurrency:'CAD',minPrice:999});
  assert.deepEqual(offers[1].priceSpecification,{'@type':'UnitPriceSpecification',priceCurrency:'CAD',price:250,unitText:'month'});
  assert.deepEqual(offers[2].priceSpecification,{'@type':'PriceSpecification',priceCurrency:'CAD',price:2500});
  assert.equal(offers[3].priceSpecification,undefined);
  for(const offer of offers){assert.equal(offer.url,`${origin}/services/#${offer.url.split('#')[1]}`);assert.equal(offer.itemOffered['@type'],'Service');}
  const keys=new Set();(function walk(node){if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==='object')for(const [key,value] of Object.entries(node)){keys.add(key);walk(value);}})(data);
  for(const banned of ['aggregateRating','review','reviewCount','ratingValue','address','location','employee','award','numberOfEmployees'])assert.ok(!keys.has(banned),banned);
});
test('no service page claim promises leads, rankings, revenue or staff replacement',async()=>{
  const banned=[/we guarantee/i,/guaranteed (?:leads|results|rankings|revenue|traffic)/i,/(?:more|new) leads every/i,/we generate leads/i,/rank(?:ed)? (?:you )?(?:#1|first|higher|on page one)/i,/top of google/i,/double your/i,/increase your revenue/i,/replaces? your (?:receptionist|dispatcher|office|staff)/i,/automate everything/i,/certified|accredited|licensed by/i];
  for(const route of routes){
    const html=(await readFile(`out/production/${route}`,'utf8')).replace(/<script[\s\S]*?<\/script>/g,'');
    for(const pattern of banned) assert.doesNotMatch(html,pattern,`${route}: ${pattern}`);
  }
  assert.ok(servicesHtml.includes('No promise of rankings, traffic or revenue.'));
  assert.ok(servicesHtml.includes('We do not promise rankings, traffic, leads or revenue.'));
});
test('the optional service-interest field offers the listed options and stays optional',async()=>{
  const home=await readFile('out/production/index.html','utf8');
  const form=home.match(/<form[\s\S]*?<\/form>/)[0];
  const select=form.match(/<select[\s\S]*?<\/select>/)[0];
  assert.match(select,/id="service" name="service"/);
  assert.doesNotMatch(select,/required/);
  for(const option of ['HVAC Website','Website Growth &amp; Care','Inquiry Capture System','Custom Workflow Automation','Not Sure Yet'])assert.ok(select.includes(`>${option}</option>`),option);
  assert.ok(form.includes('Which service are you interested in?'));
  assert.deepEqual(validateRequest({...valid,service:''}),{});
  assert.deepEqual(validateRequest({...valid,service:'HVAC Website'}),{});
  assert.deepEqual(Object.keys(validateRequest({...valid,service:'Something else'})),['service']);
  let body;
  await submitRequest({...valid,service:'Inquiry Capture System'},'/api/review',async(url,options)=>{body=JSON.parse(options.body);return new Response('{"accepted":true}');});
  assert.equal(body.service,'Inquiry Capture System');
});

test('the client bundle knows every built route, so no page re-renders as 404',async()=>{
  const entry=await readFile('preview-entry.tsx','utf8');
  const pages=JSON.parse(entry.match(/const pages = (\[[^\]]*\]);/)[1].replaceAll("'",'"'));
  const built=routes.map(route=>route==='index.html'?'home':route==='404.html'?'404':route.replace('/index.html',''));
  assert.deepEqual(pages.slice().sort(),built.slice().sort());
  // The bundle minifies quoting, so assert on the route list the bundle is built from.
  for(const page of built) assert.ok(entry.includes(page),`${page} missing from the client route list`);
});
