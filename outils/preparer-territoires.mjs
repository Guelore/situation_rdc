#!/usr/bin/env node
/**
 * Prépare data/territoires.json (TopoJSON simplifié) à partir des limites
 * administratives officielles de l'OCHA (COD-AB, niveau 2 : territoires et villes).
 *
 * Outil de développement uniquement : le site n'en a pas besoin pour fonctionner.
 *
 * 1. Télécharger « cod_admin_boundaries.geojson.zip » depuis
 *    https://data.humdata.org/dataset/cod-ab-cod  (licence CC BY-IGO)
 * 2. Décompresser l'archive, puis lancer :
 *      node outils/preparer-territoires.mjs chemin/vers/cod_admin2.geojson
 *
 * Nécessite Node 18+ et un accès réseau la première fois (npx télécharge mapshaper).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('Usage : node outils/preparer-territoires.mjs chemin/vers/cod_admin2.geojson');
  process.exit(1);
}

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = join(racine, 'data', 'territoires.json');
const dossierTmp = mkdtempSync(join(tmpdir(), 'rdc-'));
const fichierTmp = join(dossierTmp, 'territoires.json');

// Unités du niveau 2 qui sont des villes (et non des territoires).
const VILLES = new Set([
  'CD1000', 'CD2001', 'CD2002', 'CD3201', 'CD3203', 'CD4101', 'CD4206', 'CD4301',
  'CD5101', 'CD6101', 'CD6109', 'CD6110', 'CD6201', 'CD6301', 'CD7101', 'CD7106',
  'CD8103', 'CD8201', 'CD9101',
]);
// Noms plus parlants pour le public.
const RENOMMER = {
  CD6107: 'Beni (territoire)', // chef-lieu : Oïcha
};

// 5 % des points conservés : bon compromis entre lisibilité et poids.
execFileSync('npx', [
  '--yes', 'mapshaper@0.6',
  source,
  '-simplify', '5%', 'keep-shapes', 'planar',
  '-filter-fields', 'adm2_pcode,adm2_name,adm1_name',
  '-rename-fields', 'c=adm2_pcode,n=adm2_name,p=adm1_name',
  '-rename-layers', 'territoires',
  '-o', fichierTmp, 'format=topojson', 'quantization=20000',
], { stdio: 'inherit', shell: process.platform === 'win32' });

const topo = JSON.parse(readFileSync(fichierTmp, 'utf8'));
for (const g of topo.objects.territoires.geometries) {
  const p = g.properties;
  if (RENOMMER[p.c]) p.n = RENOMMER[p.c];
  if (VILLES.has(p.c)) p.v = 1;
}
topo.source = 'OCHA — COD-AB RDC (Référentiel Géographique Commun), CC BY-IGO, via HDX';

writeFileSync(sortie, JSON.stringify(topo));
rmSync(dossierTmp, { recursive: true, force: true });
console.log(`Écrit : ${sortie} (${topo.objects.territoires.geometries.length} unités)`);
