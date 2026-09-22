import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await build({entryPoints:['src/loom3d.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'site/loom3d.bundle.js',legalComments:'eof'});
await copyFile('node_modules/three/LICENSE','site/THREE-LICENSE.txt');
console.log('Built local Three.js visualization bundle.');
