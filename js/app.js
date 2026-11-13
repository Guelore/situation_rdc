/*
 * Point d'entrée : définitions partagées, chargement des données,
 * initialisation de la carte, de la légende et de la recherche.
 */
(function (RDC) {
  'use strict';

  // Niveaux de la légende, du plus grave au moins grave.
  RDC.STATUTS = {
    occupee:   { libelle: 'Occupée',               description: 'Sous le contrôle d\'un groupe armé.' },
    conflit:   { libelle: 'Conflit actif',         description: 'Combats ou attaques récurrents.' },
    risque:    { libelle: 'Risque élevé',          description: 'Présence de groupes armés, incidents fréquents.' },
    vigilance: { libelle: 'Vigilance',             description: 'Incidents ponctuels ou tensions.' },
    calme:     { libelle: 'Calme relatif',         description: 'Pas de conflit armé notable signalé. Restez prudents.' },
    inconnu:   { libelle: 'Données insuffisantes', description: 'Pas encore d\'information vérifiée.' }
  };
  RDC.ORDRE = ['occupee', 'conflit', 'risque', 'vigilance', 'calme', 'inconnu'];

  RDC.statutDe = function (zone) {
    return zone && RDC.STATUTS[zone.statut] && zone.statut !== 'inconnu' ? zone.statut : 'inconnu';
  };

  RDC.nomAffiche = function (info) {
    if (!info) return '';
    return info.v ? info.n + ' (ville)' : info.n;
  };

  RDC.formaterDate = function (iso) {
    if (!iso) return '';
    var parties = String(iso).split('-');
    try {
      var d = new Date(Date.UTC(+parties[0], (+parties[1] || 1) - 1, +parties[2] || 1));
      var options = parties.length >= 3
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
        : { month: 'long', year: 'numeric', timeZone: 'UTC' };
      return new Intl.DateTimeFormat('fr-FR', options).format(d);
    } catch (e) { return iso; }
  };

  RDC.echapper = function (texte) {
    return String(texte == null ? '' : texte).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // « frais » : revalide auprès du serveur (données qui changent souvent)
  function charger(url, frais) {
    return fetch(url, frais ? { cache: 'no-cache' } : {}).then(function (r) {
      if (!r.ok) throw new Error(url + ' : ' + r.status);
      return r.json();
    });
  }

  function construireLegende(liste) {
    liste.innerHTML = RDC.ORDRE.map(function (s) {
      return '<li title="' + RDC.echapper(RDC.STATUTS[s].description) + '"><span class="pastille pastille--' + s + '"></span>' +
        RDC.STATUTS[s].libelle + '</li>';
    }).join('');
  }

  function construireRecherche(select, carte, infos) {
    var parProvince = {};
    Object.keys(infos).forEach(function (code) {
      var p = infos[code];
      (parProvince[p.p] = parProvince[p.p] || []).push(p);
    });
    var html = '<option value="">Choisir un territoire…</option>';
    Object.keys(parProvince).sort(comparer).forEach(function (prov) {
      html += '<optgroup label="' + RDC.echapper(prov) + '">';
      parProvince[prov].sort(function (a, b) { return comparer(a.n, b.n); }).forEach(function (p) {
        html += '<option value="' + p.c + '">' + RDC.echapper(RDC.nomAffiche(p)) + '</option>';
      });
      html += '</optgroup>';
    });
    select.innerHTML = html;
    select.disabled = false;
    select.addEventListener('change', function () {
      if (select.value) carte.selectionner(select.value, true);
    });
    carte.surSelection(function (code) { if (select.value !== code) select.value = code; });
  }

  function comparer(a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); }

  function demarrer() {
    var zoneCarte = document.getElementById('zone-carte');
    var chargement = document.getElementById('carte-chargement');

    Promise.all([
      charger('data/territoires.json'),
      charger('data/zones.json', true).catch(function () { return { territoires: {} }; })
    ]).then(function (res) {
      var topo = res[0], donnees = res[1] || {};
      RDC.donnees = donnees;
      var zones = donnees.territoires || {};
      var carte = new RDC.Carte(zoneCarte, topo, zones);
      RDC.carte = carte;
      chargement.remove();

      construireLegende(document.getElementById('legende'));
      construireRecherche(document.getElementById('choix-territoire'), carte, carte.infos);

      var maj = document.getElementById('maj-donnees');
      if (donnees.maj) maj.textContent = 'Mise à jour : ' + RDC.formaterDate(donnees.maj);

      if (RDC.Panneau) RDC.panneau = new RDC.Panneau(carte, zones);
    }).catch(function (err) {
      console.error(err);
      chargement.textContent = 'La carte n\'a pas pu être chargée. Vérifiez votre connexion puis rechargez la page.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})(window.RDC = window.RDC || {});
