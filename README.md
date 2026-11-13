# Situation sécuritaire en RDC

Carte interactive, sobre et sourcée de la situation sécuritaire en République Démocratique du Congo, territoire par territoire.
Elle est pensée pour la population congolaise et pour toute personne préoccupée par la sécurité du pays.

- **Léger** : environ 53 Ko compressés au premier chargement, aucune bibliothèque, polices système.
- **Hors-ligne** : après une première visite, le site reste consultable sans connexion. Il est installable sur Android.
- **Sourcé** : chaque territoire affiche son statut, les groupes armés présents, sa date de mise à jour et ses sources.
- **Statique** : HTML, CSS et JavaScript uniquement, hébergé gratuitement sur GitHub Pages.

## Contenu

| Section | Description |
|---|---|
| Carte | 164 territoires et villes, 5 niveaux (Occupée, Conflit actif, Risque élevé, Vigilance, Calme relatif) plus « Données insuffisantes ». Zoom, recherche et fiche détaillée. |
| Actualités | Derniers rapports ONU et ONG sur la RDC via l'API ReliefWeb (OCHA). |
| Découvrir la RDC | Chiffres clés, histoire, patrimoine, drapeau, hymne national. |
| Comment aider | Gestes utiles et organisations humanitaires reconnues. |

## Structure

```
index.html                  page unique
css/style.css               charte graphique (mode sombre automatique)
js/app.js                   démarrage, légende, recherche, mode hors-ligne
js/carte.js                 carte SVG (TopoJSON, projection, zoom)
js/panneau.js               fiche territoire et liste des zones
js/actualites.js            actualités ReliefWeb
data/territoires.json       limites administratives simplifiées (OCHA)
data/zones.json             situation par territoire  ← fichier à tenir à jour
sw.js, manifest.webmanifest mode hors-ligne et installation
docs/MISE_A_JOUR.md         guide de mise à jour des zones
outils/                     scripts de développement (validation, préparation des contours)
```

## Mettre à jour la situation

Tout se passe dans `data/zones.json`. Le guide complet est dans [docs/MISE_A_JOUR.md](docs/MISE_A_JOUR.md).
Avant de publier, lancez la vérification :

```sh
node outils/valider-zones.mjs
```

> La première version du fichier a été préparée à partir d'informations disponibles jusqu'à mi-2026. Toutes les zones y sont marquées « à vérifier » : elles doivent être confirmées par des sources récentes et précises.

## Activer les actualités ReliefWeb

L'API ReliefWeb exige un identifiant d'application (`appname`) approuvé :

1. Faites la demande (gratuite) : <https://apidoc.reliefweb.int/parameters#appname>
2. Une fois l'identifiant reçu, indiquez-le dans `js/actualites.js` : `var APPNAME = 'votre-identifiant';`

En attendant, la section affiche des liens vers les sources officielles.

## Tester en local

Le site doit être servi par un serveur web : `fetch` et le mode hors-ligne ne fonctionnent pas en ouvrant directement le fichier.

```sh
npx serve .
# ou
python -m http.server 8000
```

Ouvrez ensuite <http://localhost:8000> (ou l'adresse indiquée).

## Déployer sur GitHub Pages

1. Créez un dépôt **public** sur GitHub, par exemple `situation-rdc`, sans README.
2. Reliez le dépôt local et envoyez le code :
   ```sh
   git remote add origin https://github.com/<votre-compte>/situation-rdc.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment**, puis *Source* : « Deploy from a branch », *Branch* : `main`, dossier `/ (root)`. Cliquez sur **Save**.
4. Après une à deux minutes, le site est en ligne à l'adresse `https://<votre-compte>.github.io/situation-rdc/`.

Chaque `git push` met ensuite le site à jour automatiquement. Après une modification de fichiers JS ou CSS, augmentez `VERSION` dans `sw.js` (par exemple `rdc-v2`) pour que les visiteurs reçoivent la nouvelle version.

## Sources et licences

- Limites administratives : OCHA, [COD-AB République démocratique du Congo](https://data.humdata.org/dataset/cod-ab-cod), licence CC BY-IGO.
- Actualités : [ReliefWeb](https://reliefweb.int/country/cod) (OCHA).
- Situation par territoire : sources citées dans chaque fiche (OCHA, MONUSCO, Radio Okapi, International Crisis Group, ACLED…).

Information indicative : cette carte ne remplace pas les consignes des autorités locales ni des organisations humanitaires.
