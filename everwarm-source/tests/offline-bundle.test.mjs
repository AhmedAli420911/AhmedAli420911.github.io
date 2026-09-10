import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {offlineOptions} from '../scripts/offline-config.mjs';

test('standalone bundling renders the full homeowner page with a valid image component', async t => {
 const result = await build({
  ...offlineOptions,
  globalName: 'offlineCheck',
  stdin: {
   contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server.browser'; import Home from './app/page'; export const html=renderToStaticMarkup(<Home/>);`,
   loader: 'tsx',
   resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
 });
 const script = result.outputFiles[0].text;
 assert.doesNotMatch(script, /\bprocess\.env\b/);
 const channels = [];
 class TestMessageChannel extends MessageChannel {
  constructor() {super(); channels.push(this);}
 }
 t.after(() => {for (const channel of channels) {channel.port1.close(); channel.port2.close();}});
 const context = {MessageChannel: TestMessageChannel, TextEncoder, TextDecoder, ReadableStream, TransformStream, AbortController, setTimeout, clearTimeout, queueMicrotask};
 vm.runInNewContext(script, context, {timeout: 10000});
 assert.match(context.offlineCheck.html, /Furnace problems/);
 assert.match(context.offlineCheck.html, /<img[^>]*src="\/hero.webp"/);
 assert.match(context.offlineCheck.html, /id="home-name"/);
 assert.match(context.offlineCheck.html, /View Business Workflow/);
});
