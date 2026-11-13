/*
 * Carte SVG des territoires de la RDC — sans bibliothèque.
 * Décode le TopoJSON, projette les coordonnées, dessine les territoires,
 * les limites de provinces, quelques villes repères, et gère le zoom.
 */
(function (RDC) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LARGEUR = 1000;          // largeur de référence du viewBox
  var MARGE = 0.035;           // marge autour du pays (proportion)
  var ZOOM_MAX = 14;

  // Villes repères (longitude, latitude). « s » = n'apparaît qu'en zoomant.
  var VILLES = [
    ['Kinshasa', 15.31, -4.32], ['Goma', 29.22, -1.68], ['Bukavu', 28.86, -2.51],
    ['Bunia', 30.25, 1.56], ['Kisangani', 25.19, 0.52], ['Lubumbashi', 27.48, -11.66],
    ['Mbandaka', 18.26, 0.05], ['Kananga', 22.42, -5.90],
    ['Mbuji-Mayi', 23.60, -6.14, 's'], ['Kindu', 25.93, -2.95, 's'], ['Kalemie', 29.19, -5.93, 's'],
    ['Matadi', 13.45, -5.82, 's'], ['Beni', 29.47, 0.49, 's'], ['Uvira', 29.14, -3.40, 's'],
    ['Kolwezi', 25.47, -10.71, 's'], ['Gemena', 19.77, 3.25, 's'], ['Isiro', 27.62, 2.77, 's'],
    ['Butembo', 29.29, 0.14, 's'], ['Kikwit', 18.82, -5.04, 's'], ['Bandundu', 17.37, -3.32, 's']
  ];
  // Pays voisins (repères discrets, hors du territoire congolais).
  var PAYS = [
    ['Rép. centrafricaine', 20.6, 5.9], ['Soudan du Sud', 29.6, 5.75], ['Ouganda', 30.05, -0.6, 'start'],
    ['Tanzanie', 31.0, -6.9], ['Zambie', 25.3, -13.0], ['Angola', 16.6, -9.6], ['Congo', 15.3, -0.4]
  ];

  // ---------- Décodage TopoJSON ----------
  function decoderArcs(topo) {
    var t = topo.transform, sx = t ? t.scale[0] : 1, sy = t ? t.scale[1] : 1,
        tx = t ? t.translate[0] : 0, ty = t ? t.translate[1] : 0;
    return topo.arcs.map(function (arc) {
      var x = 0, y = 0;
      return arc.map(function (p) {
        if (t) { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; }
        return [p[0], p[1]];
      });
    });
  }

  function anneau(indices, arcs) {
    var pts = [];
    indices.forEach(function (i, k) {
      var a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      pts = pts.concat(k === 0 ? a : a.slice(1));
    });
    return pts;
  }

  function polygones(geom) {
    if (geom.type === 'Polygon') return [geom.arcs];
    if (geom.type === 'MultiPolygon') return geom.arcs;
    return [];
  }

  // ---------- Projection (équirectangulaire corrigée, adaptée à l'équateur) ----------
  function creerProjection(arcs) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    arcs.forEach(function (arc) {
      arc.forEach(function (p) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
    var k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    var largeurGeo = (maxX - minX) * k, hauteurGeo = maxY - minY;
    var echelle = LARGEUR * (1 - 2 * MARGE) / largeurGeo;
    var marge = LARGEUR * MARGE;
    var hauteur = hauteurGeo * echelle + 2 * marge;
    return {
      largeur: LARGEUR,
      hauteur: hauteur,
      projeter: function (lon, lat) {
        return [marge + (lon - minX) * k * echelle, marge + (maxY - lat) * echelle];
      }
    };
  }

  function arrondir(v) { return Math.round(v * 10) / 10; }

  function cheminDepuisPoints(pts, proj, fermer) {
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      var p = proj.projeter(pts[i][0], pts[i][1]);
      d += (i === 0 ? 'M' : 'L') + arrondir(p[0]) + ' ' + arrondir(p[1]);
    }
    return fermer ? d + 'Z' : d;
  }

  function el(nom, attrs, parent) {
    var n = document.createElementNS(SVGNS, nom);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ---------- Construction de la carte ----------
  function Carte(zone, topo, zones) {
    var self = this;
    this.zone = zone;
    this.zones = zones || {};
    this.ecouteurs = [];
    this.actif = null;
    this.elements = {};      // pcode -> <path>
    this.boites = {};        // pcode -> [minX, minY, maxX, maxY] en coordonnées SVG
    this.infos = {};         // pcode -> propriétés

    var arcs = decoderArcs(topo);
    var proj = creerProjection(arcs);
    this.proj = proj;
    var geoms = topo.objects.territoires.geometries;

    var svg = el('svg', {
      'class': 'carte-svg',
      viewBox: '0 0 ' + proj.largeur + ' ' + arrondir(proj.hauteur),
      role: 'group',
      'aria-label': 'Carte des territoires de la RDC colorés selon la situation sécuritaire'
    });
    this.svg = svg;
    this.vueInitiale = { x: 0, y: 0, w: proj.largeur, h: proj.hauteur };
    this.vue = Object.assign({}, this.vueInitiale);

    // Motif hachuré pour les zones occupées (lisible sans la couleur)
    var defs = el('defs', {}, svg);
    var motif = el('pattern', { id: 'motif-occupee', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 7, height: 7, 'class': 's-occupee' }, motif);
    el('rect', { width: 2.2, height: 7, fill: 'rgba(255,255,255,.32)' }, motif);

    var gCarte = el('g', {}, svg);
    this.gCarte = gCarte;
    var gTerr = el('g', { 'class': 'territoires' }, gCarte);

    // Utilisation des arcs : pour tracer les limites de provinces et la frontière
    var usage = {}; // index d'arc -> liste de provinces

    geoms.forEach(function (g) {
      var p = g.properties;
      var d = '';
      var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      polygones(g).forEach(function (poly) {
        poly.forEach(function (ring) {
          var pts = anneau(ring, arcs);
          d += cheminDepuisPoints(pts, proj, true);
          pts.forEach(function (pt) {
            var q = proj.projeter(pt[0], pt[1]);
            if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0];
            if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1];
          });
          ring.forEach(function (i) {
            var idx = i < 0 ? ~i : i;
            (usage[idx] = usage[idx] || []).push(p.p);
          });
        });
      });
      var statut = RDC.statutDe(self.zones[p.c]);
      var chemin = el('path', {
        d: d,
        'class': 'territoire s-' + statut,
        'data-code': p.c,
        tabindex: '-1',
        role: 'button',
        'aria-label': RDC.nomAffiche(p) + ', ' + p.p + ' : ' + RDC.STATUTS[statut].libelle
      }, gTerr);
      if (statut === 'occupee') chemin.style.fill = 'url(#motif-occupee)';
      self.elements[p.c] = chemin;
      self.boites[p.c] = [minx, miny, maxx, maxy];
      self.infos[p.c] = p;
    });

    // Limites de provinces (arcs partagés par deux provinces) et frontière (arcs non partagés)
    var dProv = '', dFront = '';
    Object.keys(usage).forEach(function (idx) {
      var u = usage[idx];
      var d = cheminDepuisPoints(arcs[idx], proj, false);
      if (u.length === 1) dFront += d;
      else if (u[0] !== u[1]) dProv += d;
    });
    el('path', { d: dProv, 'class': 'provinces' }, gCarte);
    el('path', { d: dFront, 'class': 'frontiere' }, gCarte);

    // Repères : pays voisins et villes
    var gReperes = el('g', { 'class': 'reperes', 'aria-hidden': 'true' }, gCarte);
    PAYS.forEach(function (v) {
      var q = proj.projeter(v[1], v[2]);
      var t = el('text', { x: arrondir(q[0]), y: arrondir(q[1]), 'class': 'pays', 'text-anchor': v[3] || 'middle' }, gReperes);
      t.textContent = v[0];
    });
    this.textes = [];
    VILLES.forEach(function (v) {
      var q = proj.projeter(v[1], v[2]);
      var g = el('g', { 'class': 'ville' + (v[3] ? ' secondaire' : ''), transform: 'translate(' + arrondir(q[0]) + ' ' + arrondir(q[1]) + ')' }, gReperes);
      el('circle', { r: 2.6 }, g);
      var t = el('text', { x: 5, y: -4 }, g);
      t.textContent = v[0];
      self.textes.push(g);
    });

    zone.insertBefore(svg, zone.firstChild);
    this.brancherEvenements();
    this.appliquerVue();
  }

  Carte.prototype.surSelection = function (fn) { this.ecouteurs.push(fn); };

  Carte.prototype.selectionner = function (code, centrer) {
    if (this.actif && this.elements[this.actif]) this.elements[this.actif].classList.remove('actif');
    this.actif = code || null;
    if (!code || !this.elements[code]) return;
    var chemin = this.elements[code];
    chemin.classList.add('actif');
    chemin.parentNode.appendChild(chemin); // passe au premier plan pour que le contour soit visible
    if (centrer) this.zoomerSur(code);
    var info = this.infos[code];
    this.ecouteurs.forEach(function (fn) { fn(code, info); });
  };

  Carte.prototype.deselectionner = function () {
    if (this.actif && this.elements[this.actif]) this.elements[this.actif].classList.remove('actif');
    this.actif = null;
  };

  // ---------- Vue (zoom / déplacement) ----------
  Carte.prototype.appliquerVue = function () {
    var v = this.vue;
    this.svg.setAttribute('viewBox', [v.x, v.y, v.w, v.h].map(arrondir).join(' '));
    var facteur = this.vueInitiale.w / v.w;
    this.svg.classList.toggle('zoom-2', facteur >= 1.8);
    // Garde les textes et points à taille constante à l'écran :
    // « inv » = nombre d'unités SVG par pixel affiché.
    var largeurPx = this.svg.getBoundingClientRect().width || this.zone.clientWidth || 800;
    var inv = v.w / largeurPx;
    this.textes.forEach(function (g) {
      var t = g.getAttribute('transform').replace(/\s*scale\([^)]*\)/, '');
      g.setAttribute('transform', t + ' scale(' + inv.toFixed(3) + ')');
    });
    var reperesPays = this.svg.querySelectorAll('.pays');
    for (var i = 0; i < reperesPays.length; i++) reperesPays[i].style.fontSize = (10 * inv) + 'px';
  };

  Carte.prototype.limiter = function () {
    var v = this.vue, i = this.vueInitiale;
    v.w = Math.min(i.w, Math.max(i.w / ZOOM_MAX, v.w));
    v.h = v.w * i.h / i.w;
    v.x = Math.min(i.x + i.w - v.w, Math.max(i.x, v.x));
    v.y = Math.min(i.y + i.h - v.h, Math.max(i.y, v.y));
  };

  // Zoom autour d'un point exprimé en proportion de la zone affichée (0..1)
  Carte.prototype.zoomer = function (facteur, fx, fy) {
    var v = this.vue;
    if (fx === undefined) { fx = 0.5; fy = 0.5; }
    var px = v.x + v.w * fx, py = v.y + v.h * fy;
    v.w = v.w / facteur; v.h = v.h / facteur;
    v.x = px - v.w * fx; v.y = py - v.h * fy;
    this.limiter();
    this.appliquerVue();
  };

  Carte.prototype.reinitialiser = function () {
    this.vue = Object.assign({}, this.vueInitiale);
    this.appliquerVue();
  };

  Carte.prototype.zoomerSur = function (code) {
    var b = this.boites[code], i = this.vueInitiale;
    if (!b) return;
    var w = Math.max((b[2] - b[0]) * 3.2, (b[3] - b[1]) * 3.2 * i.w / i.h, i.w / 6);
    this.vue = { w: w, h: w * i.h / i.w, x: (b[0] + b[2]) / 2 - w / 2, y: 0 };
    this.vue.y = (b[1] + b[3]) / 2 - this.vue.h / 2;
    this.limiter();
    this.appliquerVue();
  };

  Carte.prototype.brancherEvenements = function () {
    var self = this, zone = this.zone, svg = this.svg;
    var bulle = document.getElementById('infobulle');
    var pointeurs = {}, depart = null, deplace = false, pincement = null;

    function rect() { return svg.getBoundingClientRect(); }

    zone.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = rect();
      self.zoomer(e.deltaY < 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }, { passive: false });

    zone.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointeurs);
      if (ids.length === 1) {
        depart = { x: e.clientX, y: e.clientY, vx: self.vue.x, vy: self.vue.y };
        deplace = false;
      } else if (ids.length === 2) {
        var a = pointeurs[ids[0]], b = pointeurs[ids[1]];
        pincement = { d: Math.hypot(a.x - b.x, a.y - b.y), w: self.vue.w };
      }
    });

    zone.addEventListener('pointermove', function (e) {
      // Infobulle (souris uniquement)
      if (e.pointerType === 'mouse' && bulle) {
        var cible = e.target.closest && e.target.closest('.territoire');
        if (cible && !depart) {
          var info = self.infos[cible.getAttribute('data-code')];
          var zr = zone.getBoundingClientRect();
          bulle.textContent = RDC.nomAffiche(info);
          bulle.style.left = (e.clientX - zr.left) + 'px';
          bulle.style.top = (e.clientY - zr.top) + 'px';
          bulle.classList.add('visible');
        } else {
          bulle.classList.remove('visible');
        }
      }
      if (!pointeurs[e.pointerId]) return;
      pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointeurs), r = rect();
      if (ids.length === 2 && pincement) {
        var a = pointeurs[ids[0]], b = pointeurs[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var cx = ((a.x + b.x) / 2 - r.left) / r.width, cy = ((a.y + b.y) / 2 - r.top) / r.height;
        var cible2 = pincement.w * pincement.d / d;
        self.zoomer(self.vue.w / cible2, cx, cy);
        deplace = true;
      } else if (ids.length === 1 && depart) {
        var dx = e.clientX - depart.x, dy = e.clientY - depart.y;
        if (!deplace && Math.hypot(dx, dy) < 6) return;
        if (!deplace) { deplace = true; zone.classList.add('glisse'); try { zone.setPointerCapture(e.pointerId); } catch (err) {} }
        self.vue.x = depart.vx - dx * self.vue.w / r.width;
        self.vue.y = depart.vy - dy * self.vue.h / r.height;
        self.limiter();
        self.appliquerVue();
      }
    });

    function fin(e) {
      delete pointeurs[e.pointerId];
      var ids = Object.keys(pointeurs);
      if (ids.length < 2) pincement = null;
      if (ids.length === 0) {
        zone.classList.remove('glisse');
        depart = null;
      } else if (ids.length === 1) {
        var p = pointeurs[ids[0]];
        depart = { x: p.x, y: p.y, vx: self.vue.x, vy: self.vue.y };
      }
    }
    zone.addEventListener('pointerup', fin);
    zone.addEventListener('pointercancel', fin);
    zone.addEventListener('pointerleave', function () { if (bulle) bulle.classList.remove('visible'); });

    svg.addEventListener('click', function (e) {
      if (deplace) { deplace = false; return; }
      var cible = e.target.closest('.territoire');
      if (cible) self.selectionner(cible.getAttribute('data-code'), false);
    });
    svg.addEventListener('keydown', function (e) {
      var cible = e.target.closest && e.target.closest('.territoire');
      if (cible && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        self.selectionner(cible.getAttribute('data-code'), false);
      }
    });

    var minuterie;
    window.addEventListener('resize', function () {
      clearTimeout(minuterie);
      minuterie = setTimeout(function () { self.appliquerVue(); }, 150);
    });

    zone.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var action = b.getAttribute('data-zoom');
        if (action === 'plus') self.zoomer(1.5);
        else if (action === 'moins') self.zoomer(1 / 1.5);
        else self.reinitialiser();
      });
    });
  };

  RDC.Carte = Carte;
})(window.RDC = window.RDC || {});
