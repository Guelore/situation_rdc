#!/usr/bin/env node
/**
 * Vérifie le fichier data/zones.json avant publication.
 *   node outils/valider-zones.mjs
 * Code de sortie 1 en cas d'erreur (utilisable en intégration continue).
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATUTS = ['occupee', 'conflit', 'risque', 'vigilance', 'calme'];
const DATE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;
const ANNEE_OU_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const erreurs = [], avertissements = [];

function lire(fichier) {
  try { return JSON.parse(readFileSync(join(racine, fichier), 'utf8')); }
  catch (e) { console.error(`✗ Impossible de lire ${fichier} : ${e.message}`); process.exit(1); }
}

const zones = lire('data/zones.json');
const topo = lire('data/territoires.json');
const noms = new Map(topo.objects.territoires.geometries.map(g => [g.properties.c, g.properties.n]));
const refs = zones.references || {};

if (!DATE.test(zones.maj || '')) erreurs.push('« maj » général manquant ou invalide (format AAAA-MM ou AAAA-MM-JJ).');
for (const [cle, r] of Object.entries(refs)) {
  if (!r.titre || !/^https:\/\//.test(r.url || '')) erreurs.push(`Référence « ${cle} » : « titre » et « url » (https://) sont obligatoires.`);
}

const ilYa60Jours = new Date(Date.now() - 60 * 864e5);
let nonVerifiees = 0;

for (const [code, z] of Object.entries(zones.territoires || {})) {
  const ici = `${code} (${noms.get(code) || '?'})`;
  if (!noms.has(code)) { erreurs.push(`${code} : code inconnu dans data/territoires.json.`); continue; }
  if (!STATUTS.includes(z.statut)) erreurs.push(`${ici} : statut « ${z.statut} » invalide (attendu : ${STATUTS.join(', ')}).`);
  if (typeof z.resume !== 'string' || z.resume.trim().length < 10) erreurs.push(`${ici} : « resume » manquant ou trop court.`);
  if (!Array.isArray(z.acteurs)) erreurs.push(`${ici} : « acteurs » doit être une liste (éventuellement vide []).`);
  if (!DATE.test(z.maj || '')) erreurs.push(`${ici} : « maj » manquant ou invalide.`);
  if (z.depuis !== undefined && !ANNEE_OU_DATE.test(z.depuis)) erreurs.push(`${ici} : « depuis » invalide (AAAA, AAAA-MM ou AAAA-MM-JJ).`);
  if (typeof z.verifie !== 'boolean') erreurs.push(`${ici} : « verifie » doit valoir true ou false.`);
  if (z.verifie === false) nonVerifiees++;

  if (!Array.isArray(z.sources) || z.sources.length === 0) {
    erreurs.push(`${ici} : au moins une source est obligatoire.`);
  } else {
    z.sources.forEach((s, i) => {
      if (typeof s === 'string') {
        if (!refs[s]) erreurs.push(`${ici} : source « ${s} » absente de « references ».`);
      } else if (!s || !/^https:\/\//.test(s.url || '') || !s.titre) {
        erreurs.push(`${ici} : source n°${i + 1} invalide (« titre » et « url » https:// obligatoires).`);
      } else if (s.date && !DATE.test(s.date)) {
        erreurs.push(`${ici} : date de la source n°${i + 1} invalide.`);
      }
    });
  }
  if (z.verifie === true && z.sources.every(s => typeof s === 'string')) {
    avertissements.push(`${ici} : marquée vérifiée mais sans source précise (article ou rapport daté).`);
  }
  if (DATE.test(z.maj || '') && new Date(z.maj) < ilYa60Jours && ['occupee', 'conflit', 'risque'].includes(z.statut)) {
    avertissements.push(`${ici} : zone sensible non mise à jour depuis plus de 60 jours.`);
  }
}

const total = Object.keys(zones.territoires || {}).length;
console.log(`Zones renseignées : ${total} / ${noms.size} — non vérifiées : ${nonVerifiees}`);
avertissements.forEach(a => console.log('⚠ ' + a));
erreurs.forEach(e => console.log('✗ ' + e));
if (erreurs.length) { console.log(`\n${erreurs.length} erreur(s). Corrigez-les avant de publier.`); process.exit(1); }
console.log('✓ data/zones.json est valide.');
