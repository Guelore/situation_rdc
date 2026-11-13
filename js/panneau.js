/*
 * Panneau latéral : liste des zones par statut et fiche détaillée d'un territoire.
 * Sur mobile, la fiche s'ouvre en tiroir depuis le bas de l'écran.
 */
(function (RDC) {
  'use strict';

  var e = function (t) { return RDC.echapper(t); };

  function Panneau(carte, donnees) {
    var self = this;
    this.carte = carte;
    this.zones = (donnees && donnees.territoires) || {};
    this.references = (donnees && donnees.references) || {};
    this.panneau = document.getElementById('panneau');
    this.fiche = document.getElementById('fiche');
    this.contenu = document.getElementById('fiche-contenu');

    this.construireListe(document.getElementById('liste-zones'));

    carte.surSelection(function (code, info) { self.ouvrir(code, info); });
    document.getElementById('fiche-fermer').addEventListener('click', function () { self.fermer(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !self.fiche.hidden) self.fermer();
    });
  }

  Panneau.prototype.construireListe = function (conteneur) {
    var carte = this.carte, zones = this.zones, groupes = {};
    Object.keys(carte.infos).forEach(function (code) {
      var s = RDC.statutDe(zones[code]);
      (groupes[s] = groupes[s] || []).push(carte.infos[code]);
    });
    var html = '<h3 class="fiche__titre-sources">Liste des territoires par situation</h3>';
    RDC.ORDRE.forEach(function (s) {
      var liste = groupes[s];
      if (!liste || !liste.length) return;
      liste.sort(function (a, b) { return a.n.localeCompare(b.n, 'fr'); });
      html += '<details' + (s === 'occupee' || s === 'conflit' ? ' open' : '') + '>' +
        '<summary><span class="pastille pastille--' + s + '"></span>' + RDC.STATUTS[s].libelle +
        ' <span style="font-weight:400;color:var(--encre-2)">(' + liste.length + ')</span></summary><ul>' +
        liste.map(function (p) {
          return '<li><button type="button" data-code="' + p.c + '">' + e(RDC.nomAffiche(p)) + '</button></li>';
        }).join('') + '</ul></details>';
    });
    conteneur.innerHTML = html;
    conteneur.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-code]');
      if (b) carte.selectionner(b.getAttribute('data-code'), true);
    });
  };

  Panneau.prototype.source = function (s) {
    var ref = typeof s === 'string' ? this.references[s] : s;
    if (!ref || !ref.url) return '';
    return '<li><a href="' + e(ref.url) + '" target="_blank" rel="noopener">' + e(ref.titre || ref.url) + '</a>' +
      (ref.date ? ' <span class="actu__meta">(' + e(RDC.formaterDate(ref.date)) + ')</span>' : '') + '</li>';
  };

  Panneau.prototype.ouvrir = function (code, info) {
    var z = this.zones[code], s = RDC.statutDe(z), st = RDC.STATUTS[s];
    var nom = RDC.nomAffiche(info);
    var lienRapports = 'https://reliefweb.int/updates?advanced-search=%28PC75%29&search=' +
      encodeURIComponent(info.n.replace(/\s*\(.*\)$/, ''));

    var html = '<h3 id="fiche-titre" tabindex="-1">' + e(nom) + '</h3>' +
      '<p class="panneau__province">' + (info.v ? 'Ville' : 'Territoire') + ' · Province : ' + e(info.p) + '</p>' +
      '<div class="statut-etiquette"><span class="pastille pastille--' + s + '"></span>' + st.libelle + '</div>' +
      (z && z.verifie === false ? '<span class="a-verifier" title="Information non encore confirmée par une source récente">À vérifier</span>' : '');

    if (z && s !== 'inconnu') {
      html += '<p class="fiche__resume">' + e(z.resume || st.description) + '</p><dl>';
      if (z.acteurs && z.acteurs.length) html += '<dt>Groupes armés</dt><dd>' + z.acteurs.map(e).join(', ') + '</dd>';
      if (z.depuis) html += '<dt>Depuis</dt><dd>' + e(RDC.formaterDate(z.depuis)) + '</dd>';
      if (z.maj) html += '<dt>Mise à jour</dt><dd>' + e(RDC.formaterDate(z.maj)) + '</dd>';
      html += '</dl>';
      var sources = (z.sources || []).map(this.source, this).join('');
      if (sources) html += '<h4 class="fiche__titre-sources">Sources</h4><ul class="fiche__sources">' + sources + '</ul>';
    } else {
      html += '<p class="fiche__resume">Aucune information vérifiée pour ce territoire pour l\'instant. ' +
        '<strong>Cela ne signifie pas que la zone est sûre.</strong></p>';
    }
    html += '<p><a href="' + lienRapports + '" target="_blank" rel="noopener">Rapports récents sur ' + e(info.n.replace(/\s*\(.*\)$/, '')) + ' (ReliefWeb) ↗</a></p>';

    this.contenu.innerHTML = html;
    this.fiche.hidden = false;
    this.panneau.classList.add('avec-fiche');
    var titre = document.getElementById('fiche-titre');
    try { titre.focus({ preventScroll: true }); } catch (err) { titre.focus(); }
  };

  Panneau.prototype.fermer = function () {
    this.fiche.hidden = true;
    this.panneau.classList.remove('avec-fiche');
    this.carte.deselectionner();
    var select = document.getElementById('choix-territoire');
    if (select) select.value = '';
  };

  RDC.Panneau = Panneau;
})(window.RDC = window.RDC || {});
