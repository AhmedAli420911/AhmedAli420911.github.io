import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
await build({configFile: false, root, plugins: [react()], define: {'process.env.NODE_ENV': '"production"'}, build: {outDir: 'out/preview-assets', emptyOutDir: true, lib: {entry: 'preview-entry.tsx', formats: ['iife'], name: 'ServiceCapture', fileName: () => 'site.js'}, cssCodeSplit: false, sourcemap: false}});
await build({configFile: false, root, plugins: [react()], define: {'process.env.NODE_ENV': '"production"'}, build: {outDir: 'out/render', emptyOutDir: true, ssr: 'render-entry.tsx', rollupOptions: {output: {entryFileNames: 'render.mjs'}}}});
const {render, siteTitle, siteDescription, siteConfig} = await import(pathToFileURL(path.join(root, 'out/render/render.mjs')).href);
const css = await readFile('out/preview-assets/service-capture-co.css', 'utf8').catch(async () => {
  const {readdir} = await import('node:fs/promises');
  const files = await readdir('out/preview-assets');
  const name = files.find(file => file.endsWith('.css'));
  if (!name) throw new Error('No compiled CSS found');
  return readFile(path.join('out/preview-assets',name),'utf8');
});
const js = await readFile('out/preview-assets/site.js','utf8');
const demo = await readFile('public/demo/index.html');
const favicon = await readFile('public/favicon.svg','utf8');
const origin = siteConfig.websiteDomain.replace(/\/+$/, '');
const indexable = ['home','interactive-demo','privacy','terms','accessibility'];
const pagePath = page => page === 'home' ? '/' : `/${page}/`;
const pageTitle = page => page === 'home' ? siteTitle : `${page === '404' ? 'Page not found' : page.charAt(0).toUpperCase()+page.slice(1).replaceAll('-',' ')} | Service Capture Co.`;
const attr = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// Structured data states only what the business has supplied: no address, ratings, reviews or results.
const organization = JSON.stringify({'@context': 'https://schema.org', '@type': 'Organization', name: 'Service Capture Co.', url: `${origin}/`, description: siteDescription, ...(siteConfig.businessEmail ? {email: siteConfig.businessEmail} : {}), ...(siteConfig.businessPhone ? {telephone: siteConfig.businessPhone} : {}), ...(siteConfig.calendarUrl ? {potentialAction: {'@type': 'ReserveAction', name: 'Book a 20-Minute Review', target: siteConfig.calendarUrl}} : {})}).replaceAll('<','\\u003c');
const seo = (page, offline) => offline || !origin ? '' : !indexable.includes(page) ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${origin}${pagePath(page)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Service Capture Co."><meta property="og:title" content="${attr(pageTitle(page))}"><meta property="og:description" content="${attr(siteDescription)}"><meta property="og:url" content="${origin}${pagePath(page)}">${page === 'home' ? `<script type="application/ld+json">${organization}</script>` : ''}`;
const doc = (page, offline = false) => `<!doctype html><html lang="en" data-preview="${offline ? 'offline' : 'static'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageTitle(page)}</title><meta name="description" content="${siteDescription}">${seo(page, offline)}<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}">${offline ? `<style>${css.replaceAll('</style','<\\/style')}</style>` : '<link rel="stylesheet" href="/assets/site.css">'}</head><body><div id="root">${render(page, offline)}</div>${offline ? `<script id="everwarm-data" type="application/octet-stream">${demo.toString('base64')}</script><script>${js.replaceAll('</script','<\\/script')}</script>` : '<script src="/assets/site.js" defer></script>'}</body></html>`;
await mkdir('out/production/assets',{recursive:true});
await writeFile('out/production/assets/site.css',css);
await writeFile('out/production/assets/site.js',js);
for (const page of ['home','interactive-demo','privacy','terms','accessibility','404']) {
  const file = page === 'home' ? 'index.html' : page === '404' ? '404.html' : `${page}/index.html`;
  await mkdir(path.dirname(`out/production/${file}`),{recursive:true});
  await writeFile(`out/production/${file}`,doc(page));
}
await cp('public/demo','out/production/demo',{recursive:true});
await cp('public/favicon.svg','out/production/favicon.svg');
if (origin) {
  await writeFile('out/production/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
  await writeFile('out/production/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(page => `  <url><loc>${origin}${pagePath(page)}</loc></url>`).join('\n')}\n</urlset>\n`);
}
await writeFile('out/Service-Capture-Co-Preview.html',doc('home',true));
console.log('Static production pages and self-contained Service-Capture-Co-Preview.html generated. EverWarm embedded unchanged.');
