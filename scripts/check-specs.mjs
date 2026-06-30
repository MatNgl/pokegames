import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Verifie que chaque service possede son fichier de test (Regle projet).
// Les wrappers d'infrastructure sont exclus : ce sont de fines couches sur des libs tierces.
const ROOT = 'apps/api/src';
const EXCLUDE = new Set(['prisma.service.ts', 'redis.service.ts']);

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = walk(ROOT);
const services = files.filter((f) => {
  const base = f.split(/[\\/]/).pop() ?? '';
  return base.endsWith('.service.ts') && !base.endsWith('.spec.ts') && !EXCLUDE.has(base);
});

const missing = services.filter((svc) => !existsSync(svc.replace(/\.service\.ts$/, '.service.spec.ts')));

if (missing.length > 0) {
  console.error('Fichiers de test manquants pour les services suivants :');
  for (const m of missing) console.error(`  - ${m}`);
  console.error('Regle projet : chaque service doit avoir son fichier de test (*.service.spec.ts).');
  process.exit(1);
}

console.log(`Verification des tests : ${services.length} services couverts par un fichier de test.`);
