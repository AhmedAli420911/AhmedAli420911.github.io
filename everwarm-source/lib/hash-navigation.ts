type HashSource = {
 read: () => string;
 subscribe: (listener: () => void) => () => void;
};

/** #main is a focus target; it must not replace the current application route. */
export function createHashNavigation(source: HashSource) {
 let hash = '';
 return {
  getSnapshot: () => hash,
  getServerSnapshot: () => '',
  subscribe(listener: () => void) {
   const update = () => {
    const next = source.read();
    if (next === '#main' || next === hash) return;
    hash = next;
    listener();
   };
   const unsubscribe = source.subscribe(update);
   update();
   return unsubscribe;
  },
 };
}

export const hashNavigation = createHashNavigation({
 read: () => window.location.hash,
 subscribe(listener) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
 },
});
