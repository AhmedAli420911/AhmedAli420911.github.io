import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
import {offlineOptions} from './offline-config.mjs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd();
const photo='data:image/webp;base64,'+(await fs.readFile('public/hero.webp')).toString('base64');
const js=await build({...offlineOptions,entryPoints:['offline-entry.tsx'],plugins:[{name:'embed-hero',setup(b){b.onLoad({filter:/app\/page\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('src="/hero.webp"',`src="${photo}"`),loader:'tsx'}));}}]});
// Local files have no framework deployment or image-optimization environment.
assert.doesNotMatch(js.outputFiles[0].text,/\bprocess\.env\b/,'Standalone JavaScript must not require a Node environment');
const style=await postcss([tailwind()]).process(await fs.readFile('app/globals.css','utf8'),{from:path.join(root,'app/globals.css')});
const favicon='data:image/svg+xml;base64,'+(await fs.readFile('public/favicon.svg')).toString('base64');
const html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EverWarm Home Comfort — HVAC Inquiry Capture System</title><meta name="description" content="A fictional HVAC Inquiry Capture System with website forms, scripted call simulation, and browser-local tracking."><link rel="icon" href="${favicon}"><style>${style.css.replaceAll('</style','<\\/style')}</style></head><body><div id="root"></div><noscript>Please enable JavaScript to use this fictional estimate-request and lead-tracker demonstration.</noscript><script>${js.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
await fs.mkdir('deliverables',{recursive:true});await fs.writeFile('deliverables/EverWarm-Demo.html',html);console.log('Standalone demo built:',Buffer.byteLength(html),'bytes');
