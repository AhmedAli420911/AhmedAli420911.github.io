// Match the image component used by the Vinext app, including its ESM export.
// The standalone file has no server image optimizer or deployment environment.
export const offlineOptions = {
 bundle: true,
 write: false,
 minify: true,
 format: 'iife',
 jsx: 'automatic',
 target: 'es2020',
 alias: {'next/image': 'vinext/shims/image'},
 define: {
  'process.env.NODE_ENV': '"production"',
  'process.env.__VINEXT_IMAGE_REMOTE_PATTERNS': '"[]"',
  'process.env.__VINEXT_IMAGE_DOMAINS': '"[]"',
  'process.env.__VINEXT_IMAGE_DEVICE_SIZES': 'undefined',
  'process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_SVG': '"false"',
  'process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_LOCAL_IP': '"false"',
 },
};
