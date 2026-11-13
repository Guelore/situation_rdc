# Mettre à jour la carte

La carte se construit entièrement à partir de **`data/zones.json`**. Ce guide explique comment le modifier sans rien casser.

> **Principe de prudence.** En cas de doute, choisissez le statut le plus grave, ou retirez la zone du fichier (elle s'affichera alors « Données insuffisantes »). N'indiquez jamais « Calme relatif » sans source : quelqu'un pourrait décider d'un déplacement en se fiant à la carte.

## 1. Trouver le code d'un territoire

Chaque territoire ou ville a un code officiel de l'OCHA (« pcode »), par exemple `CD6111` pour Rutshuru.
Pour le trouver, ouvrez le site, cliquez sur le territoire puis, dans la console du navigateur (F12), tapez :

```js
RDC.carte.actif
```

Les codes suivent la logique `CD` + province + territoire : `CD61..` = Nord-Kivu, `CD62..` = Sud-Kivu, `CD54..` = Ituri, etc.

## 2. Modifier ou ajouter une zone

Dans `data/zones.json`, sous `"territoires"` :

```json
"CD6111": {
  "statut": "occupee",
  "acteurs": ["M23/AFC"],
  "resume": "Texte court, factuel et sans jugement.",
  "depuis": "2022-06",
  "maj": "2026-11-13",
  "verifie": true,
  "sources": [
    "ocha",
    { "titre": "Titre exact de l'article ou du rapport", "url": "https://…", "date": "2026-11-10" }
  ]
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `statut` | oui | `occupee`, `conflit`, `risque`, `vigilance` ou `calme` (voir ci-dessous). |
| `acteurs` | oui | Groupes armés présents. Liste vide `[]` s'il n'y en a pas. |
| `resume` | oui | Une à trois phrases factuelles, en français simple. |
| `depuis` | non | Début de la situation : `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ`. |
| `maj` | oui | Date de **votre** dernière vérification : `AAAA-MM` ou `AAAA-MM-JJ`. |
| `verifie` | oui | `true` une fois l'information confirmée par une source récente et précise, sinon `false` (le site affiche alors « À vérifier »). |
| `sources` | oui | Au moins une. Soit une clé de `"references"` (sources générales), soit un objet `{titre, url, date}` pour un article ou un rapport précis (**à privilégier**). |

Pensez aussi à mettre à jour le champ `"maj"` en haut du fichier : c'est la date affichée au-dessus de la carte.

## 3. Choisir le statut

| Statut | Signification | Exemples d'indices |
|---|---|---|
| **Occupée** (`occupee`) | Le territoire, ou l'essentiel de celui-ci, est administré ou contrôlé par un groupe armé. | Chef-lieu tenu par un groupe armé, administration parallèle. |
| **Conflit actif** (`conflit`) | Combats ou attaques contre les civils récurrents (plusieurs par mois). | Ligne de front, massacres répétés. |
| **Risque élevé** (`risque`) | Groupes armés présents, incidents fréquents, mais pas de front ouvert. | Incursions, enlèvements, violences autour des mines. |
| **Vigilance** (`vigilance`) | Incidents ponctuels, tensions, criminalité notable. | Tensions intercommunautaires, afflux de déplacés. |
| **Calme relatif** (`calme`) | Aucun conflit armé notable signalé récemment. | À confirmer avec au moins une source récente. |

## 4. Sources fiables recommandées

- **OCHA** (rapports de situation, aperçus humanitaires) : <https://www.unocha.org/democratic-republic-congo>
- **ReliefWeb** (tous les rapports ONU et ONG) : <https://reliefweb.int/country/cod>
- **MONUSCO** : <https://monusco.unmissions.org/>
- **Radio Okapi** : <https://www.radiookapi.net/>
- **International Crisis Group — CrisisWatch** (synthèse mensuelle) : <https://www.crisisgroup.org/crisiswatch>
- **ACLED** (données d'incidents géolocalisées) : <https://acleddata.com/>

Évitez les réseaux sociaux et les sources non identifiées. Croisez toujours au moins deux sources quand une zone change de statut.

## 5. Vérifier avant de publier

```sh
node outils/valider-zones.mjs
```

Le script signale :
- les **erreurs**, à corriger obligatoirement : code inconnu, statut invalide, source manquante, date mal écrite ;
- les **avertissements** : zone sensible non revue depuis plus de 60 jours, zone marquée vérifiée sans source précise.

Sur GitHub, ce contrôle s'exécute automatiquement à chaque modification (onglet *Actions*).

## 6. Publier

Avec git :

```sh
git add data/zones.json
git commit -m "Mise à jour de la situation au Nord-Kivu (13 novembre 2026)"
git push
```

Sans git : sur GitHub, ouvrez `data/zones.json`, cliquez sur le crayon ✏️ (*Edit this file*), modifiez, puis *Commit changes*. Le site se met à jour en une à deux minutes.
