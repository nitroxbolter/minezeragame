const fs = require('node:fs');
const path = require('node:path');

const specs = require('../assets/mob-sounds-26.2');
const minecraftRoot = process.argv[2] || path.join(process.env.APPDATA || '', '.minecraft');
const indexPath = path.join(minecraftRoot, 'assets', 'indexes', '32.json');
const objectsRoot = path.join(minecraftRoot, 'assets', 'objects');
const outputRoot = path.resolve(__dirname, '..', 'assets', 'sounds', 'minecraft');

if (!fs.existsSync(indexPath)) throw new Error(`Índice de assets não encontrado: ${indexPath}`);
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const logicalNames = new Set();
for (const spec of Object.values(specs)) {
  for (const names of Object.values(spec)) for (const name of names) logicalNames.add(`minecraft/sounds/${name}.ogg`);
}

const missing = [];
let copied = 0;
for (const logicalName of [...logicalNames].sort()) {
  const entry = index.objects[logicalName];
  if (!entry) { missing.push(logicalName); continue; }
  const source = path.join(objectsRoot, entry.hash.slice(0, 2), entry.hash);
  if (!fs.existsSync(source)) { missing.push(`${logicalName} (objeto ${entry.hash} ausente)`); continue; }
  const relative = logicalName.replace(/^minecraft\/sounds\//, '');
  const destination = path.join(outputRoot, ...relative.split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  copied++;
}

if (missing.length) {
  console.error(`Falharam ${missing.length} sons:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Importados ${copied} sons oficiais do índice 32 para ${outputRoot}`);
}
