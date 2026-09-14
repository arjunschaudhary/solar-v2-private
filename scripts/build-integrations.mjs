import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[root+'lib/solar-core.ts'],outfile:root+'integrations/apps-script/Core.gs',bundle:true,format:'iife',globalName:'SolarCore',target:'es2020',platform:'neutral',banner:{js:'// Generated from lib/solar-core.ts. Rebuild with node scripts/build-integrations.mjs.'}});
execFileSync('python',[root+'scripts/generate-workflows.py'],{stdio:'inherit'});
