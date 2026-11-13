/*
 * Actualités sécuritaires via l'API ReliefWeb (OCHA / Nations unies).
 * Chargées seulement quand la section approche de l'écran (économie de données).
 */
(function (RDC) {
  'use strict';

  /*
   * IDENTIFIANT RELIEFWEB : l'API exige un « appname » approuvé.
   * Demande gratuite : https://apidoc.reliefweb.int/parameters#appname
   * Tant qu'il est vide, la section affiche des liens vers les sources officielles.
   */
  var APPNAME = '';

  var API = 'https://api.reliefweb.int/v2/reports';
  var CLE_CACHE = 'rdc-actualites-v1';
  var NOMBRE = 9;

  var LIENS_REPLI = [
    ['ReliefWeb — tous les rapports sur la RDC', 'https://reliefweb.int/country/cod'],
    ['OCHA — situation humanitaire en RDC', 'https://www.unocha.org/democratic-republic-congo'],
    ['Radio Okapi — actualités', 'https://www.radiookapi.net/'],
    ['MONUSCO — communiqués', 'https://monusco.unmissions.org/']
  ];

  function requete(langue) {
    var p = [
      'appname=' + encodeURIComponent(APPNAME),
      'limit=' + NOMBRE,
      'sort[]=date.created:desc',
      'filter[operator]=AND',
      'filter[conditions][0][field]=primary_country.iso3',
      'filter[conditions][0][value]=cod',
      'fields[include][]=title',
      'fields[include][]=url_alias',
      'fields[include][]=source.shortname',
      'fields[include][]=date.created',
      'fields[include][]=format.name'
    ];
    if (langue) {
      p.push('filter[conditions][1][field]=language.code', 'filter[conditions][1][value]=' + langue);
    }
    return fetch(API + '?' + p.join('&')).then(function (r) {
      if (!r.ok) throw new Error('ReliefWeb : ' + r.status);
      return r.json();
    }).then(function (json) {
      return (json.data || []).map(function (d) {
        var f = d.fields || {};
        return {
          titre: f.title,
          url: f.url_alias || ('https://reliefweb.int/node/' + d.id),
          source: (f.source || []).map(function (s) { return s.shortname; }).join(', '),
          date: f.date && f.date.created ? f.date.created.slice(0, 10) : '',
          format: f.format && f.format[0] ? f.format[0].name : ''
        };
      });
    });
  }

  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CLE_CACHE)); } catch (e) { return null; }
  }
  function ecrireCache(items) {
    try { localStorage.setItem(CLE_CACHE, JSON.stringify({ quand: new Date().toISOString(), items: items })); } catch (e) {}
  }

  function afficher(liste, items) {
    var e = RDC.echapper;
    liste.innerHTML = items.map(function (a) {
      return '<li class="actu"><a href="' + e(a.url) + '" target="_blank" rel="noopener">' + e(a.titre) + '</a>' +
        '<span class="actu__meta">' + e(a.source) + (a.date ? ' · ' + e(RDC.formaterDate(a.date)) : '') + '</span></li>';
    }).join('');
  }

  function afficherRepli(liste, etat, message) {
    liste.innerHTML = LIENS_REPLI.map(function (l) {
      return '<li class="actu"><a href="' + l[1] + '" target="_blank" rel="noopener">' + l[0] + ' ↗</a>' +
        '<span class="actu__meta">Source officielle</span></li>';
    }).join('');
    etat.textContent = message;
  }

  function charger() {
    var liste = document.getElementById('actus');
    var etat = document.getElementById('actus-etat');
    if (!liste) return;

    if (!APPNAME) {
      afficherRepli(liste, etat, 'Consultez les dernières informations directement auprès de ces sources fiables.');
      return;
    }

    etat.textContent = 'Chargement des actualités…';
    requete('fr').then(function (items) {
      return items.length >= 3 ? items : requete('');
    }).then(function (items) {
      if (!items.length) throw new Error('vide');
      afficher(liste, items);
      ecrireCache(items);
      etat.textContent = 'Source : ReliefWeb (OCHA). Rapports publiés par les agences de l\'ONU et des ONG reconnues.';
    }).catch(function () {
      var cache = lireCache();
      if (cache && cache.items && cache.items.length) {
        afficher(liste, cache.items);
        etat.textContent = 'Connexion indisponible : actualités enregistrées le ' +
          RDC.formaterDate(cache.quand.slice(0, 10)) + '.';
      } else {
        afficherRepli(liste, etat, 'Les actualités n\'ont pas pu être chargées. Voici les sources officielles à consulter.');
      }
    });
  }

  function demarrer() {
    var section = document.getElementById('actualites');
    if (!section) return;
    if (!('IntersectionObserver' in window)) return charger();
    var obs = new IntersectionObserver(function (entrees) {
      if (entrees.some(function (e) { return e.isIntersecting; })) {
        obs.disconnect();
        charger();
      }
    }, { rootMargin: '400px 0px' });
    obs.observe(section);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})(window.RDC = window.RDC || {});
