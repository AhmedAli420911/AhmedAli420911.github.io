import {LEGACY_KEY, loadInquiries, persistInquiries, seedLeads, type Lead} from './inquiries';

type InquiryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Snapshot = {leads: Lead[]; ready: boolean; storageOk: boolean; dataIssue: boolean};
const serverSnapshot: Snapshot = {leads: [], ready: false, storageOk: true, dataIssue: false};

/** Cached snapshots keep browser I/O outside rendering and support SSR hydration. */
export function createInquiryStore(getStorage: () => InquiryStorage) {
 let snapshot = serverSnapshot;
 const listeners = new Set<() => void>();
 function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
 }
 function initialize() {
  if (snapshot.ready) return;
  try {
   const loaded = loadInquiries(getStorage());
   publish({leads: loaded.leads, ready: true, storageOk: loaded.writable, dataIssue: false});
  } catch (error) {
   const dataIssue = error instanceof SyntaxError || (error instanceof Error && error.message === 'Saved records could not be read.');
   publish({leads: seedLeads(), ready: true, storageOk: false, dataIssue});
  }
 }
 function save(leads: Lead[], reset = false) {
  let storageOk = false;
  const dataIssue = snapshot.dataIssue && !reset;
  if (!dataIssue) {
   try {
    const storage = getStorage();
    persistInquiries(storage, leads);
    if (reset) storage.removeItem(LEGACY_KEY);
    storageOk = true;
   } catch {
    // Retain the user's changes in memory and expose the storage warning.
    storageOk = false;
   }
  }
  publish({leads, ready: true, storageOk, dataIssue});
  return storageOk;
 }
 return {
  getSnapshot: () => snapshot,
  getServerSnapshot: () => serverSnapshot,
  subscribe(listener: () => void) {
   listeners.add(listener);
   initialize();
   return () => {listeners.delete(listener);};
  },
  save,
  reset: () => save(seedLeads(), true),
 };
}

export const inquiryStore = createInquiryStore(() => window.localStorage);
