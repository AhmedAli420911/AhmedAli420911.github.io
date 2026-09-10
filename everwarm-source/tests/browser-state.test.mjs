import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';

async function loadModule(relativePath) {
 const result = await build({entryPoints: [new URL(relativePath, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022'});
 return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const {createInquiryStore} = await loadModule('../lib/inquiry-store.ts');
const {createHashNavigation} = await loadModule('../lib/hash-navigation.ts');
const legacyKey = 'everwarm-demo-leads-v1';
const currentKey = 'everwarm-inquiries-v2';
function memoryStorage(initial = {}) {
 const data = new Map(Object.entries(initial));
 return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
}

test('browser store hydrates once, preserves saved records, and keeps SSR snapshots free of browser I/O', () => {
 const storage = memoryStorage({[legacyKey]: JSON.stringify([{id: 'legacy-test', name: 'Test Caller', status: 'Contacted'}])});
 let reads = 0;
 const store = createInquiryStore(() => {reads++; return storage;});
 const server = store.getServerSnapshot();
 assert.equal(reads, 0);
 assert.equal(server.ready, false);
 assert.equal(store.getSnapshot(), server);
 let notifications = 0;
 const unsubscribe = store.subscribe(() => notifications++);
 const loaded = store.getSnapshot();
 assert.equal(loaded.ready, true);
 assert.equal(loaded.leads[0].id, 'legacy-test');
 assert.equal(loaded.leads[0].status, 'Contacted');
 assert.equal(loaded.storageOk, true);
 assert.equal(loaded, store.getSnapshot());
 const unsubscribeAgain = store.subscribe(() => {});
 assert.equal(reads, 1);
 assert.equal(notifications, 1);
 assert.equal(store.getServerSnapshot(), server);
 assert.equal(server.ready, false);
 unsubscribe(); unsubscribeAgain();
 store.save([]);
 assert.equal(notifications, 1);
 assert.deepEqual(JSON.parse(storage.getItem(currentKey)).leads, []);
});

test('browser store saves status and notes and restores them through a fresh subscription', () => {
 const storage = memoryStorage();
 const store = createInquiryStore(() => storage);
 const unsubscribe = store.subscribe(() => {});
 const inquiry = {...store.getSnapshot().leads[0], status: 'Contacted', notes: [{text: 'Test follow-up', date: '2026-09-09T12:00:00.000Z'}]};
 assert.equal(store.save([inquiry]), true);
 const freshStore = createInquiryStore(() => storage);
 const unsubscribeFresh = freshStore.subscribe(() => {});
 assert.deepEqual(freshStore.getSnapshot().leads, [inquiry]);
 unsubscribe(); unsubscribeFresh();
});

test('corrupt stored data stays untouched until an explicit reset restores all channels', () => {
 const storage = memoryStorage({[currentKey]: '{broken', [legacyKey]: 'legacy backup'});
 const store = createInquiryStore(() => storage);
 const unsubscribe = store.subscribe(() => {});
 assert.equal(store.getSnapshot().dataIssue, true);
 assert.equal(store.save([]), false);
 assert.equal(storage.getItem(currentKey), '{broken');
 assert.equal(storage.getItem(legacyKey), 'legacy backup');
 store.reset();
 assert.equal(store.getSnapshot().dataIssue, false);
 assert.equal(store.getSnapshot().storageOk, true);
 assert.deepEqual(store.getSnapshot().leads.map(lead => lead.source), ['Website Form', 'After-Hours AI', 'Missed-Call Recovery']);
 assert.equal(JSON.parse(storage.getItem(currentKey)).leads.length, 3);
 assert.equal(storage.getItem(legacyKey), null);
 unsubscribe();
});

test('blocked browser storage keeps edits in memory and reports failed persistence', () => {
 const store = createInquiryStore(() => {throw new Error('Storage denied');});
 const unsubscribe = store.subscribe(() => {});
 assert.equal(store.getSnapshot().ready, true);
 assert.equal(store.getSnapshot().storageOk, false);
 assert.equal(store.getSnapshot().dataIssue, false);
 assert.equal(store.save([]), false);
 assert.deepEqual(store.getSnapshot().leads, []);
 store.reset();
 assert.equal(store.getSnapshot().leads.length, 3);
 assert.equal(store.getSnapshot().storageOk, false);
 unsubscribe();
});

test('failed legacy cleanup is reported while retaining the reset records', () => {
 const storage = memoryStorage({[legacyKey]: JSON.stringify([{id: 'old-test'}])});
 storage.removeItem = () => {throw new Error('Removal denied');};
 const store = createInquiryStore(() => storage);
 const unsubscribe = store.subscribe(() => {});
 assert.equal(store.reset(), false);
 assert.equal(store.getSnapshot().storageOk, false);
 assert.equal(store.getSnapshot().leads.length, 3);
 assert.equal(JSON.parse(storage.getItem(currentKey)).leads.length, 3);
 assert.ok(storage.getItem(legacyKey));
 unsubscribe();
});

test('hash navigation restores deep links, follows changes, preserves the route for skip links, and unsubscribes', () => {
 let hash = '#call-simulator';
 const listeners = new Set();
 const navigation = createHashNavigation({read: () => hash, subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);}});
 assert.equal(navigation.getServerSnapshot(), '');
 let notifications = 0;
 const unsubscribe = navigation.subscribe(() => notifications++);
 assert.equal(navigation.getSnapshot(), '#call-simulator');
 hash = '#tracker'; listeners.forEach(listener => listener());
 assert.equal(navigation.getSnapshot(), '#tracker');
 hash = '#main'; listeners.forEach(listener => listener());
 assert.equal(navigation.getSnapshot(), '#tracker');
 assert.equal(notifications, 2);
 assert.equal(navigation.getServerSnapshot(), '');
 unsubscribe();
 assert.equal(listeners.size, 0);
 hash = '#system-demo';
 const unsubscribeAgain = navigation.subscribe(() => notifications++);
 assert.equal(navigation.getSnapshot(), '#system-demo');
 unsubscribeAgain();
});
