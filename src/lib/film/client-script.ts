/**
 * Le script embarqué dans le fichier HTML autonome — toute l'interactivité de la
 * couverture. Sorti de `render-html.ts` pour rester lisible à mesure que le
 * palier « WOW » s'étoffe.
 *
 * ⚠️ RÈGLE ABSOLUE : ce module exporte du JavaScript sous forme de littéral de
 * gabarit. Il ne doit contenir NI accent grave NI `${` — sinon le gabarit se
 * termine au milieu du script (piège déjà vécu). Tout le code client utilise donc
 * des guillemets simples et de la concaténation.
 *
 * Contenu (palier 1) :
 *   · compteurs et chiffres à rouleaux d'odomètre
 *   · relief 3D suivant la souris + reflet spéculaire
 *   · beignes : survol / verrouillage / lecture au centre / RAYONS X (secteur → titres)
 *   · curseur « et si » sur l'éventail, avec retour élastique au consensus
 *   · cascade « Pourquoi ce chiffre ? »
 *   · panneau de transparence (cibles passées : réussites ET ratés)
 *   · générique nominatif (carton de titre, se lève au geste)
 *   · révélation au défilement, bouton Rejouer
 */
export const clientScript = `
(function(){
  'use strict';

  var FILM  = window.__FILM__ || {};
  var COVER = window.__COVER__ || {};
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var NB = String.fromCharCode(160);
  var nf = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
  function money(n){ return nf.format(Math.round(n)) + NB + '$'; }
  function pct(n){
    var s = (n >= 0 ? '+' : '') + n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return s + NB + '%';
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function clamp01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function q(sel, root){ return (root || document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ═════════ Chiffres à rouleaux d'odomètre ═════════
     Chaque chiffre est une colonne 0-9 qui roule verticalement. Mise à jour
     instantanée possible (pendant le glissement du curseur) ou animée. */
  function Odo(el){
    var cols = [];      // { col, strip, digit }
    var lastText = '';
    var cellH = 0;      // hauteur MESURÉE d'une cellule, en pixels

    /* On déplace les rouleaux en PIXELS mesurés, pas en pourcentage : la fenêtre
       de découpe et la cellule partagent alors exactement la même frontière. En
       pourcentage, l'arrondi de sous-pixel (typique aux zooms Windows 125/150 %)
       laissait apparaître un filet du chiffre voisin. */
    function measure(){
      if (!cols.length) return;
      var probe = cols[0].strip.firstChild;
      var h = probe ? probe.getBoundingClientRect().height : 0;
      if (h > 0) {
        cellH = h;
        cols.forEach(function(c){ c.col.style.height = h + 'px'; });
      }
    }

    function build(text){
      el.textContent = '';
      cols = [];
      for (var i = 0; i < text.length; i++){
        var ch = text.charAt(i);
        if (ch >= '0' && ch <= '9'){
          var col = document.createElement('span'); col.className = 'odo-col';
          var strip = document.createElement('span'); strip.className = 'odo-strip';
          for (var d = 0; d <= 9; d++){
            var cell = document.createElement('span'); cell.className = 'odo-d';
            cell.textContent = String(d); strip.appendChild(cell);
          }
          col.appendChild(strip); el.appendChild(col);
          cols.push({ col: col, strip: strip, digit: -1 });
        } else {
          var sp = document.createElement('span'); sp.className = 'odo-sep';
          sp.textContent = ch === ' ' ? NB : ch;
          el.appendChild(sp);
        }
      }
      lastText = text;
      measure();
    }
    // La taille du texte suit clamp() : elle change avec la largeur de la fenêtre.
    window.addEventListener('resize', function(){ measure(); reapply(); });

    function reapply(){
      cols.forEach(function(c){
        if (c.digit < 0) return;
        c.strip.style.transition = 'none';
        c.strip.style.transform = 'translateY(' + (-c.digit * cellH).toFixed(2) + 'px)';
      });
    }

    /* Place un rouleau sans animation. */
    function put(c, digit){
      c.digit = digit;
      c.strip.style.transition = 'none';
      c.strip.style.transform = 'translateY(' + (-digit * cellH).toFixed(2) + 'px)';
    }

    /* Prépare la structure sur la valeur FINALE (donc les bonnes largeurs), les
       rouleaux BROUILLÉS.

       ⚠️ LE piège du « zéro derrière », signalé trois fois. On partait de tous les
       rouleaux à zéro : le montant apparaissait donc en fondu en affichant
       « 000 000 $ » avant de rouler. Sur un relevé de portefeuille, ça ne se lit
       pas comme une animation — ça se lit comme un compte à zéro.
       Chaque colonne part maintenant à QUATRE crans de sa cible, vers le haut ou
       vers le bas selon le chiffre : aucune rangée de zéros n'est possible, le
       trajet est court, et le flou de mouvement (.odo.spin) dit franchement qu'un
       mécanisme tourne. */
    function prime(value){
      var text = money(value);
      build(text);
      var k = 0;
      for (var i = 0; i < text.length; i++){
        var ch = text.charAt(i);
        if (ch < '0' || ch > '9') continue;
        var c = cols[k++];
        if (!c) continue;
        var target = Number(ch);
        put(c, target >= 5 ? target - 4 : target + 4);
      }
      lastText = text;
    }

    var spinT = null;
    function set(value, animate){
      var text = money(value);
      if (text.length !== lastText.length || cols.length === 0) build(text);
      if (!cellH) measure();
      var k = 0, moved = 0;
      for (var i = 0; i < text.length; i++){
        var ch = text.charAt(i);
        if (ch < '0' || ch > '9') continue;
        var target = Number(ch);
        var c = cols[k++];
        if (!c) continue;
        if (c.digit === target && animate) continue;
        if (!animate || reduce) { put(c, target); continue; }
        moved++;
        c.digit = target;
        c.strip.style.transition = 'transform .62s cubic-bezier(.22,1,.36,1) ' + (k * 0.045).toFixed(3) + 's';
        c.strip.style.transform = 'translateY(' + (-target * cellH).toFixed(2) + 'px)';
      }
      lastText = text;
      // Flou de mouvement le temps du trajet : les chiffres intermédiaires se
      // lisent alors comme du mouvement, jamais comme un montant.
      if (moved && !reduce){
        el.classList.add('spin');
        if (spinT) clearTimeout(spinT);
        spinT = setTimeout(function(){ el.classList.remove('spin'); }, 680 + cols.length * 45);
      }
    }
    return { set: set, prime: prime };
  }

  var odos = {};   // clé = data-odo, valeur = instance

  /* Masque À L'INSTANT, sans fondu — LE piège du « zéro derrière ».
     Le balisage affiche d'abord le montant en clair (repli sans script). Quand on
     bâtit les rouleaux, ils partent tous à zéro : si l'on masque avec la
     transition active, le navigateur ANIME l'opacité de 1 vers 0 et le client voit
     « 000 000 $ » s'effacer en fondu à la place de son montant, pendant presque
     une demi-seconde. On coupe donc la transition, on masque, on force le calcul
     de style pour figer cet état, puis on rend la transition — le fondu d'ARRIVÉE
     reste animé. */
  function hideNow(el){
    el.style.transition = 'none';
    el.style.opacity = '0';
    void el.offsetHeight;
    el.style.transition = '';
  }

  function initOdos(){
    qa('[data-odo]').forEach(function(el){
      var key = el.getAttribute('data-odo');
      var val = parseFloat(el.getAttribute('data-value')) || 0;
      var delay = parseFloat(el.getAttribute('data-delay') || '0');
      var o = Odo(el);
      odos[key] = o;
      if (reduce) { o.set(val, false); el.style.opacity = '1'; return; }
      // Rouleaux à zéro sur la bonne largeur, invisibles jusqu'au départ : aucun
      // chiffre parasite ne s'affiche avant que l'animation ne commence.
      hideNow(el);
      o.prime(val);

      var started = false;
      function go(d){
        if (started) return;
        started = true;
        setTimeout(function(){ el.style.opacity = '1'; o.set(val, true); }, d);
      }
      /* Un odomètre situé plus bas dans la page ne doit pas rouler dans le vide :
         il attend d'être à l'écran. Sinon le client descend après la fête et le
         montant n'a plus qu'à apparaître, sans son mécanisme. */
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 || !window.IntersectionObserver) { go(delay); return; }
      var io = new IntersectionObserver(function(en){
        en.forEach(function(e){ if (e.isIntersecting) { io.disconnect(); go(160); } });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 });
      io.observe(el);
    });
  }

  /* ═════════ Compteurs simples (petits montants) ═════════ */
  function runCounters(){
    qa('[data-count]').forEach(function(el){
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var delay = parseFloat(el.getAttribute('data-delay') || '0');
      if (reduce) { el.textContent = money(to); return; }
      el.textContent = money(0);
      setTimeout(function(){
        var t0 = null, dur = 1200;
        function step(t){
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          el.textContent = money(to * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, delay);
    });
  }

  /* ═════════ Relief 3D + reflet ═════════ */
  qa('[data-tilt]').forEach(function(card){
    if (reduce) return;
    card.addEventListener('pointermove', function(e){
      if (document.body.classList.contains('dragging')) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((px - .5) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((.5 - py) * 4).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      card.classList.add('live');
    });
    card.addEventListener('pointerleave', function(){
      card.classList.remove('live');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ═════════ Beignes : survol, verrouillage, lecture au centre, RAYONS X ═════════ */
  var CIRC = 2 * Math.PI * 42;

  function paintDonut(dl, slices){
    var svg = q('.donut', dl);
    if (!svg) return;
    svg.textContent = '';
    var cum = 0;
    slices.forEach(function(s, i){
      var len = (s.pct / 100) * CIRC;
      var rot = (cum / 100) * 360 - 90;
      cum += s.pct;
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'arc');
      c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', '42');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', s.color);
      c.setAttribute('stroke-width', '15');
      c.setAttribute('stroke-dasharray', len.toFixed(2) + ' ' + (CIRC - len).toFixed(2));
      c.setAttribute('data-slice', 'x-' + i);
      c.setAttribute('data-name', s.label);
      c.setAttribute('data-pct', s.pct.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + NB + '%');
      c.style.setProperty('--len', len.toFixed(2));
      c.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      c.style.animationDelay = (0.06 * i).toFixed(2) + 's';
      svg.appendChild(c);
    });
    return slices;
  }

  function renderLegend(dl, slices, cad) {
    var lg = q('.lg', dl);
    if (!lg) return;
    lg.textContent = '';
    slices.forEach(function(s, i){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lg-row'; b.setAttribute('data-for', 'x-' + i);
      b.style.setProperty('--i', String(i));
      b.innerHTML = '<span class="sw" style="background:' + s.color + ';--c:' + s.color + '"></span>'
        + '<span class="lg-name"></span><span class="lg-pct"></span>';
      q('.lg-name', b).textContent = s.label;
      q('.lg-pct', b).textContent = cad && s.value != null
        ? money(s.value)
        : s.pct.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + NB + '%';
      lg.appendChild(b);
    });
    wireLegend(dl);
  }

  function wireLegend(dl){
    var mid = q('.dn-mid', dl);
    var midB = mid ? q('b', mid) : null;
    var midS = mid ? q('span', mid) : null;
    var locked = null;

    function show(id){
      var arc = q('[data-slice="' + id + '"]', dl);
      if (!arc) return;
      dl.classList.add('focus');
      qa('.arc', dl).forEach(function(a){ a.classList.remove('on'); });
      arc.classList.add('on');
      if (midB) midB.textContent = arc.getAttribute('data-pct') || '';
      if (midS) midS.textContent = arc.getAttribute('data-name') || '';
    }
    function clear(){
      if (locked) { show(locked); return; }
      dl.classList.remove('focus');
      qa('.arc', dl).forEach(function(a){ a.classList.remove('on'); });
    }
    dl._show = show; dl._clear = clear;

    qa('.lg-row', dl).forEach(function(row){
      var id = row.getAttribute('data-for');
      row.addEventListener('mouseenter', function(){ show(id); });
      row.addEventListener('focus', function(){ show(id); });
      row.addEventListener('mouseleave', clear);
      row.addEventListener('blur', clear);
      row.addEventListener('click', function(){
        // Rayons X : si cette tranche est un secteur qui contient des titres, on plonge.
        var name = q('.lg-name', row) ? q('.lg-name', row).textContent : '';
        if (dl.getAttribute('data-donut') === 'sec' && drillInto(dl, name)) return;
        locked = (locked === id) ? null : id;
        if (locked) show(locked); else clear();
      });
    });
    qa('.arc', dl).forEach(function(a){
      a.addEventListener('mouseenter', function(){ show(a.getAttribute('data-slice')); });
      a.addEventListener('mouseleave', clear);
      a.addEventListener('click', function(){
        if (dl.getAttribute('data-donut') === 'sec') drillInto(dl, a.getAttribute('data-name') || '');
      });
    });
  }

  /* Rayons X : redessine le beigne des secteurs avec les TITRES du secteur. */
  function drillInto(dl, sectorLabel){
    var groups = COVER.drill || {};
    var g = groups[sectorLabel];
    if (!g || !g.length) return false;
    var back = q('#drill-back');
    var title = q('#drill-title');
    dl.classList.remove('focus');
    paintDonut(dl, g);
    renderLegend(dl, g, false);
    if (back) back.hidden = false;
    if (title) {
      title.textContent = g.length === 1
        ? sectorLabel + ' — un seul titre'
        : sectorLabel + ' — ' + g.length + ' titres';
    }
    dl.classList.add('drilled');
    return true;
  }

  function drillOut(){
    var dl = q('[data-donut="sec"]');
    if (!dl) return;
    paintDonut(dl, COVER.sectors || []);
    renderLegend(dl, COVER.sectors || [], false);
    dl.classList.remove('drilled');
    var back = q('#drill-back'); if (back) back.hidden = true;
    var title = q('#drill-title'); if (title) title.textContent = 'Secteurs — actions et FNB';
  }

  qa('.dl').forEach(function(dl){ wireLegend(dl); });
  var backBtn = q('#drill-back');
  if (backBtn) backBtn.addEventListener('click', drillOut);

  /* ═════════ Curseur « et si » sur l'éventail ═════════
     t = 0 (prudent) · 0,5 (consensus) · 1 (optimiste). Interpolation linéaire
     par titre — la somme des apports interpolés est, par linéarité, exactement
     la borne interpolée du total. Retour élastique au consensus au relâchement :
     aucun état figé sur « optimiste » (exigence de conformité). */
  var gauge = q('#gauge');
  var scen = FILM.hero && FILM.hero.scenarios ? FILM.hero.scenarios : null;
  var base = FILM.hero ? FILM.hero.portfolioValue : 0;
  var contribs = FILM.contributions || [];
  var incomeScen = FILM.incomeForScenarios || 0;
  var currentT = 0.5;

  function gainAt(t){
    if (!scen) return 0;
    return t <= 0.5 ? lerp(scen.low, scen.mid, t / 0.5) : lerp(scen.mid, scen.high, (t - 0.5) / 0.5);
  }
  function contribAt(c, t){
    return t <= 0.5 ? lerp(c.gainLow, c.gainMid, t / 0.5) : lerp(c.gainMid, c.gainHigh, (t - 0.5) / 0.5);
  }

  function applyT(t, animate){
    currentT = t;
    var gain = gainAt(t);
    var value = base + gain;
    var pc = base > 0 ? (gain / base) * 100 : 0;

    if (odos.proj) odos.proj.set(value, !!animate);
    var badge = q('#proj-badge');
    if (badge) badge.textContent = pct(pc);

    // Teinte de la carte : plus on va vers l'optimiste, plus le vert est franc.
    var proj = q('.hero .proj');
    if (proj) proj.style.setProperty('--tint', String(t));

    // État : hypothèse manuelle vs consensus (libellé de conformité)
    var hint = q('#gauge-hint');
    var manual = Math.abs(t - 0.5) > 0.02;
    if (hint) {
      hint.textContent = manual
        ? 'Hypothèse manuelle — relâchez pour revenir au consensus'
        : 'Glissez la poignée pour explorer les hypothèses';
      hint.classList.toggle('manual', manual);
    }
    qa('.scen > div').forEach(function(d){ d.classList.remove('active'); });
    if (!manual) { var m = q('.scen .is-mid'); if (m) m.classList.add('active'); }
    else if (t < 0.5) { var l = q('.scen .is-lo'); if (l) l.classList.add('active'); }
    else { var h2 = q('.scen .is-hi'); if (h2) h2.classList.add('active'); }

    updateCascade(t);
    if (gauge) {
      var kn = q('.knob', gauge), md = q('.mid', gauge);
      var p = gaugePosFor(t);
      if (kn) kn.style.left = 'calc(' + p + '% - 5px)';
      if (md) md.style.left = 'calc(' + p + '% - 1px)';
    }
  }

  /* Position en % le long de la piste, cohérente avec le rendu serveur. */
  var GP = COVER.gaugePos || { lo: 8, mid: 50, hi: 92 };
  function gaugePosFor(t){
    return t <= 0.5 ? lerp(GP.lo, GP.mid, t / 0.5) : lerp(GP.mid, GP.hi, (t - 0.5) / 0.5);
  }
  function tForClientX(x){
    var track = q('.track', gauge);
    if (!track) return 0.5;
    var r = track.getBoundingClientRect();
    var p = clamp01((x - r.left) / r.width) * 100;
    if (p <= GP.mid) return clamp01(((p - GP.lo) / (GP.mid - GP.lo)) * 0.5);
    return clamp01(0.5 + ((p - GP.mid) / (GP.hi - GP.mid)) * 0.5);
  }

  if (gauge && scen) {
    var knob = q('.knob', gauge);
    var dragging = false;

    function onDown(e){
      if (reduce) return;
      dragging = true;
      document.body.classList.add('dragging');
      gauge.classList.add('grabbing');
      if (knob && knob.setPointerCapture && e.pointerId != null) {
        try { knob.setPointerCapture(e.pointerId); } catch (err) { /* sans capture */ }
      }
      applyT(tForClientX(e.clientX), false);
      e.preventDefault();
    }
    function onMove(e){ if (dragging) applyT(tForClientX(e.clientX), false); }
    function onUp(){
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('dragging');
      gauge.classList.remove('grabbing');
      springBackToConsensus();
    }

    // Retour élastique : on ramène t vers 0,5 en 550 ms.
    function springBackToConsensus(){
      var from = currentT, t0 = null, dur = 550;
      function step(ts){
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e2 = 1 - Math.pow(1 - p, 3);
        applyT(from + (0.5 - from) * e2, false);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    gauge.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // Clavier : la poignée est un vrai curseur accessible.
    if (knob) {
      knob.addEventListener('keydown', function(e){
        var step = e.shiftKey ? 0.2 : 0.05;
        if (e.key === 'ArrowLeft')  { applyT(clamp01(currentT - step), false); e.preventDefault(); }
        if (e.key === 'ArrowRight') { applyT(clamp01(currentT + step), false); e.preventDefault(); }
        if (e.key === 'Home')  { applyT(0, false); e.preventDefault(); }
        if (e.key === 'End')   { applyT(1, false); e.preventDefault(); }
        if (e.key === 'Escape' || e.key === 'Enter') { springBackToConsensus(); e.preventDefault(); }
      });
    }
    // Clic direct sur une colonne de scénario
    var map = { 'is-lo': 0, 'is-mid': 0.5, 'is-hi': 1 };
    Object.keys(map).forEach(function(cls){
      var el = q('.scen .' + cls);
      if (!el) return;
      el.addEventListener('click', function(){
        applyT(map[cls], true);
        if (cls !== 'is-mid') setTimeout(springBackToConsensus, 1800);
      });
    });
  }

  /* ═════════ Cascade « Pourquoi ce chiffre ? » ═════════ */
  var cascadeOpen = false;
  function updateCascade(t){
    var wrap = q('#cascade-rows');
    if (!wrap || !cascadeOpen) return;
    var maxAbs = 1;
    contribs.forEach(function(c){ maxAbs = Math.max(maxAbs, Math.abs(contribAt(c, t))); });
    maxAbs = Math.max(maxAbs, Math.abs(incomeScen));
    qa('.cas-row', wrap).forEach(function(row){
      var idx = row.getAttribute('data-idx');
      var val, lbl;
      if (idx === 'income') { val = incomeScen; }
      else { var c = contribs[Number(idx)]; if (!c) return; val = contribAt(c, t); }
      lbl = q('.cas-val', row);
      if (lbl) lbl.textContent = (val >= 0 ? '+' : '') + money(val);
      var bar = q('.cas-bar i', row);
      if (bar) bar.style.width = (Math.abs(val) / maxAbs * 100).toFixed(1) + '%';
      row.classList.toggle('neg', val < 0);
    });
    var tot = q('#cascade-total');
    if (tot) tot.textContent = (gainAt(t) >= 0 ? '+' : '') + money(gainAt(t));
  }

  function buildCascade(){
    var wrap = q('#cascade-rows');
    if (!wrap || wrap.childElementCount) return;
    var rows = contribs.map(function(c, i){ return { idx: String(i), name: c.symbol, sub: c.name }; });
    if (incomeScen > 0) rows.push({ idx: 'income', name: 'Revenus', sub: 'dividendes et coupons de l\\'année' });
    rows.forEach(function(r, i){
      var d = document.createElement('div');
      d.className = 'cas-row'; d.setAttribute('data-idx', r.idx);
      d.style.animationDelay = (i * 0.045).toFixed(2) + 's';
      d.innerHTML = '<span class="cas-sym"></span><span class="cas-bar"><i></i></span><span class="cas-val"></span>';
      q('.cas-sym', d).textContent = r.name;
      q('.cas-sym', d).title = r.sub;
      wrap.appendChild(d);
    });
  }

  var casBtn = q('#cascade-btn');
  if (casBtn) {
    casBtn.addEventListener('click', function(){
      var panel = q('#cascade');
      if (!panel) return;
      cascadeOpen = !cascadeOpen;
      buildCascade();
      panel.hidden = !cascadeOpen;
      casBtn.setAttribute('aria-expanded', cascadeOpen ? 'true' : 'false');
      casBtn.classList.toggle('open', cascadeOpen);
      if (cascadeOpen) {
        // Un élément « hidden » n'entre jamais en intersection : l'observateur ne
        // lui aurait jamais retiré son opacity:0. On le révèle donc à la main.
        panel.classList.add('in');
        panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
        updateCascade(currentT);
      }
    });
  }

  /* ═════════ Carrousel Sommaire ⁄ Trajectoire ═════════
     Bascule MANUELLE (décision produit) : onglets, flèches du clavier, glissement
     tactile. La hauteur est verrouillée sur la plus haute des deux vues pour que
     rien ne saute quand on change — mesuré, jamais devinée. */
  var track = q('#car-track');
  var carousel = q('#carousel');
  var tabs = qa('.car-tab');
  var curView = 'sommaire';

  function lockCarHeight(){
    if (!track || !carousel) return;
    var views = qa('.car-view', track);
    if (views.length < 2) return;
    var max = 0;
    views.forEach(function(v){
      var prev = v.style.visibility;
      v.style.visibility = 'hidden';
      v.removeAttribute('aria-hidden');
      max = Math.max(max, v.scrollHeight);
      v.style.visibility = prev;
    });
    carousel.style.height = max + 'px';
    applyViewA11y();
  }
  /* La vue INACTIVE est masquée (hors du parcours clavier), mais seulement quand
     le glissement est TERMINÉ : la masquer tout de suite ferait disparaître d'un
     coup la vue sortante au lieu de la laisser glisser. On expose aussi l'état
     via data-sliding, ce qui rend le carrousel testable sans deviner un délai. */
  var slideTimer = null;
  function applyViewA11y(){
    qa('.car-view', track).forEach(function(v){
      v.setAttribute('aria-hidden', v.getAttribute('data-view') === curView ? 'false' : 'true');
    });
  }
  function showView(name){
    if (!track || name === curView) return;
    curView = name;
    track.classList.toggle('to-traj', name === 'trajectoire');
    tabs.forEach(function(t){
      var on = t.getAttribute('data-view') === name;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.classList.remove('invite');
    });
    // Pendant le glissement, les DEUX vues restent visibles.
    qa('.car-view', track).forEach(function(v){ v.setAttribute('aria-hidden', 'false'); });
    if (track.parentNode) track.parentNode.setAttribute('data-sliding', '1');
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = setTimeout(function(){
      applyViewA11y();
      if (track.parentNode) track.parentNode.removeAttribute('data-sliding');
    }, reduce ? 0 : 600);
  }
  tabs.forEach(function(t){
    t.addEventListener('click', function(){ showView(t.getAttribute('data-view')); });
    t.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight') { showView('trajectoire'); e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { showView('sommaire'); e.preventDefault(); }
    });
  });
  if (carousel) {
    // Glissement tactile : seulement si le geste est franchement horizontal, pour
    // ne jamais voler le défilement vertical de la page.
    var sx = 0, sy = 0, swiping = false;
    carousel.addEventListener('pointerdown', function(e){
      if (e.pointerType === 'mouse') return;
      sx = e.clientX; sy = e.clientY; swiping = true;
    });
    carousel.addEventListener('pointerup', function(e){
      if (!swiping) return;
      swiping = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      showView(dx < 0 ? 'trajectoire' : 'sommaire');
    });
    lockCarHeight();
    window.addEventListener('resize', lockCarHeight);
  }

  /* ═════════ Survol du graphique de trajectoire ═════════ */
  var box = q('#traj-box');
  var CH = COVER.chart;
  var proj = FILM.projection;
  if (box && CH && proj) {
    var cursor = q('.traj-cursor', box);
    var dot = q('.traj-cursor-dot', box);
    var tip = q('#traj-tip');
    var pinned = false;

    var innerW = CH.w - CH.padL - CH.padR;
    var innerH = CH.h - CH.padT - CH.padB;
    function xOf(t){ return CH.padL + (t / 12) * innerW; }
    function yOf(v){ return CH.padT + (1 - (v - CH.yMin) / (CH.yMax - CH.yMin)) * innerH; }

    function showAt(monthFloat){
      var t = Math.max(0, Math.min(12, Math.round(monthFloat)));
      var pt = proj.points[t];
      if (!pt) return;
      var x = xOf(t), y = yOf(pt.mid);
      if (cursor) { cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); cursor.setAttribute('opacity', '.28'); }
      if (dot) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('opacity', '1'); }
      if (tip) {
        tip.hidden = false;
        // Bridée aux extrémités : l'infobulle ne doit jamais sortir du cadre.
        var lp = Math.max(16, Math.min(84, (x / CH.w) * 100));
        tip.style.left = lp.toFixed(2) + '%';
        tip.style.top = (y / CH.h * 100).toFixed(2) + '%';
        tip.style.marginTop = '-12px';
        tip.innerHTML = '<div class="m">' + (t === 0 ? 'Aujourd\\'hui' : 'Dans ' + t + ' mois') + '</div>'
          + '<div class="v">' + money(pt.mid) + '</div>'
          + '<div class="r">fourchette <b>' + money(pt.low) + '</b> &ndash; <b>' + money(pt.high) + '</b></div>'
          + '<div class="r">dont revenus encaissés <b>' + money(pt.incomeCum) + '</b></div>';
      }
    }
    function hide(){
      if (pinned) return;
      if (cursor) cursor.setAttribute('opacity', '0');
      if (dot) dot.setAttribute('opacity', '0');
      if (tip) tip.hidden = true;
    }
    function monthFromEvent(e){
      var r = box.getBoundingClientRect();
      var xv = ((e.clientX - r.left) / r.width) * CH.w;   // en unités du repère
      return ((xv - CH.padL) / innerW) * 12;
    }
    box.addEventListener('pointermove', function(e){ showAt(monthFromEvent(e)); });
    box.addEventListener('pointerleave', hide);
    box.addEventListener('click', function(e){
      pinned = !pinned;
      if (pinned) showAt(monthFromEvent(e)); else hide();
    });
    box.style.cursor = 'crosshair';
  }

  /* ═════════ Panneau de transparence ═════════ */
  var trBtn = q('#trust-pill');
  if (trBtn) {
    trBtn.addEventListener('click', function(){
      var p = q('#trust-panel');
      if (!p) return;
      var open = p.hidden;
      p.hidden = !open;
      trBtn.classList.toggle('open', open);
      trBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* Le montant fantôme qui voyageait a été RETIRÉ : il atterrissait sur le
     montant projeté pendant que ses rouleaux tournaient, ce qui donnait un
     chiffre parasite derrière le nombre (signalé deux fois par Nicolas). Un
     effet décoratif ne vaut pas un chiffre douteux dans un document client. */

  /* ═════════ Révélation au défilement ═════════ */
  function observeReveals(){
    var els = qa('.reveal,.reveal-f');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function(e){ e.classList.add('in'); });
      return;
    }
    // Marge basse volontairement faible : un bloc court (le pied de page) ne
    // franchirait jamais une marge de 10 % et resterait invisible à jamais.
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -2% 0px', threshold: .01 });
    els.forEach(function(e){ io.observe(e); });
  }

  /* ═════════ Chorégraphie ═════════ */
  var ANIMATED = '.rise,.arc,.bar .col,.pb i,.accent,.gauge .span,.gauge .end,.badge,.scen>div,.lg-row,.arrow svg';
  function startChoreography(){
    document.body.classList.remove('waiting');
    // applyT AVANT initOdos, sinon le montant projeté ne roule jamais : applyT
    // posait déjà les bons chiffres, et l'animation saute toute colonne dont le
    // chiffre est déjà bon. Le montant vedette se contentait d'apparaître.
    applyT(0.5, false);
    initOdos();
    runCounters();
    observeReveals();
    // Invitation à découvrir la trajectoire, une fois le montant posé.
    var tj = q('#tab-traj');
    if (tj && !reduce) { tj.classList.remove('invite'); void tj.offsetWidth; tj.classList.add('invite'); }
    if (typeof lockCarHeight === 'function') setTimeout(lockCarHeight, 60);
  }

  function replay(){
    qa('.reveal,.reveal-f').forEach(function(e){ e.classList.remove('in'); });
    qa(ANIMATED).forEach(function(el){
      var inline = el.style.animation;
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = inline || '';
    });
    odos = {};
    startChoreography();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  var rb = q('#replay');
  if (rb) rb.addEventListener('click', replay);

  /* ═════════ Générique nominatif — « Le plateau clair » ═════════
     Carton de titre : il RESTE à l'écran et ne se lève qu'au geste du spectateur.
     En mouvement réduit il reste aussi, mais figé : image fixe, aucune vidéo,
     aucune transition. On ne le supprime plus d'office — c'est la couverture du
     document, pas une animation. */
  function runIntro(done){
    var intro = q('#intro');
    if (!intro) { done(); return; }

    var scene = intro.querySelector('.gen-scene');
    var vid   = intro.querySelector('.gen-video');
    var h1    = q('#intro-name');
    var btn   = q('#intro-skip');
    var url   = null;
    var parti = false;
    var debordInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function fixe(){ if (scene) scene.setAttribute('data-etat', 'fixe'); }

    /* ── La taille du nom est MESURÉE, jamais devinée ──
       Compter les caractères serait un mauvais indicateur : en Montserrat 800, un
       patronyme riche en M et en W fait près du double d’un patronyme en i et en l.
       On part d'un plafond et on descend jusqu'à ce que le nom tienne dans sa
       colonne, en deux lignes au plus (trois sur téléphone). La valeur part en style
       en ligne : aucune requête de média ne redeclare font-size sur .gen-nom, sinon
       elle mentirait — un style en ligne gagne toujours. */
    function ajusteNom(){
      if (!h1 || !h1.parentNode) return;
      var col = h1.parentNode.clientWidth;
      if (!col) return;
      var maxLignes = window.innerWidth < 700 ? 3 : 2;
      var t = Math.max(30, Math.min(112, Math.round(col * 0.18), Math.round(window.innerHeight * 0.15)));
      while (t > 30) {
        h1.style.fontSize = t + 'px';
        var lignes = Math.round(h1.getBoundingClientRect().height / (t * 1.02));
        if (lignes <= maxLignes && ligneLaPlusLarge(h1) <= h1.clientWidth + 1) break;
        t -= 2;
      }
      h1.style.fontSize = t + 'px';
    }

    /* Largeur de la ligne de TEXTE la plus large — ce qui attrape le mot
       indivisible qui déborde.
       ⚠️ On mesurait ça avec scrollWidth. C'était faux, et sournois : scrollWidth
       compte TOUT ce qui déborde à droite, y compris un pseudo-élément décoratif.
       Le jour où le nom a reçu un halo en ::before débordant de 6 %, la condition
       est devenue impossible à satisfaire, la boucle est descendue jusqu'à sa
       borne, et le nom du client s'est affiché en 30 px au lieu de 112. Aucune
       erreur, aucun avertissement — juste un titre minuscule. Une plage ne mesure
       que les boîtes de ligne du texte : aucun décor ne peut plus fausser le
       calcul. Piège vécu. */
    function ligneLaPlusLarge(el){
      var r = document.createRange();
      r.selectNodeContents(el);
      var boites = r.getClientRects();
      var max = 0;
      for (var i = 0; i < boites.length; i++) if (boites[i].width > max) max = boites[i].width;
      return max;
    }

    /* Les polices sont incorporées en base64 : la promesse se résout presque tout
       de suite. Sans cette attente, on mesurerait avec les métriques de la police
       de repli et la taille serait fausse. Filet à 400 ms. */
    function quandPolices(cb){
      var fait = false;
      function go(){ if (fait) return; fait = true; cb(); }
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(go)['catch'](go);
      }
      setTimeout(go, 400);
    }

    var tRedim = null;
    function auRedim(){ if (tRedim) clearTimeout(tRedim); tRedim = setTimeout(ajusteNom, 150); }
    window.addEventListener('resize', auRedim);

    /* ── La boucle vidéo ──
       Le base64 voyage dans un îlot de texte, PAS dans un src=data: : Safari exige
       des requêtes par plage d’octets sur les médias et refuse régulièrement les URI
       data:. Un Blob, lui, y répond partout. Au moindre accroc on retombe sur
       l’image fixe, qui subit exactement les mêmes masques : le raccord avec la
       page est identique, personne ne voit la différence. */
    function demarreVideo(){
      var ilot = document.getElementById('intro-video-b64');
      if (!vid || !ilot || !ilot.textContent) { fixe(); return; }
      try {
        // ⚠️ DOUBLE barre oblique inverse OBLIGATOIRE. Ce module est un littéral de
        // gabarit : « \\s » y est une séquence d'échappement inconnue, que JavaScript
        // réduit à « s ». Écrit simplement, le code émis devenait /s+/g et effaçait
        // TOUTES LES LETTRES « s » du base64 — neuf mille caractères — donnant un
        // flux vidéo illisible et un repli silencieux sur l'image fixe. Piège vécu.
        var bin = atob(ilot.textContent.replace(/\\s+/g, ''));
        var oct = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) oct[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([oct], { type: 'video/mp4' }));
      } catch (e) { fixe(); return; }
      vid.muted = true;               // iOS ignore parfois l'attribut seul
      vid.addEventListener('error', fixe);
      vid.src = url;
      var p = vid.play();
      if (p && p['catch']) p['catch'](fixe);
      setTimeout(function(){ if (!parti && vid.readyState === 0) fixe(); }, 1500);
    }

    /* Onglet en arrière-plan : on rend le décodeur. On ne gèle JAMAIS la boucle sur
       un minuteur — une vidéo qui s’arrête en pleine rencontre se lit comme une panne. */
    document.addEventListener('visibilitychange', function(){
      if (!vid || parti || reduce || !vid.src) return;
      if (document.hidden) { try { vid.pause(); } catch (e) {} }
      else { var p = vid.play(); if (p && p['catch']) p['catch'](function(){}); }
    });

    /* Le generique peut rester affiche dix minutes pendant que le conseiller parle.
       Deux boucles tournent — la comete et le souffle du bouton — et ca ne doit pas
       chauffer un processeur graphique pour un onglet que personne ne regarde. Une
       pause n'est pas une coupure : au retour, les deux reprennent exactement ou
       elles etaient, sans saut. */
    document.addEventListener('visibilitychange', function(){
      if (parti) return;
      if (document.hidden) intro.classList.add('gen-pause');
      else intro.classList.remove('gen-pause');
    });

    quandPolices(function(){
      ajusteNom();
      intro.classList.add('gen-pret');
      if (reduce) { fixe(); return; }
      // Deux rafraîchissements avant de décoder : la première image du générique
      // est peinte AVANT que le fil principal se charge du demi-méga de base64.
      requestAnimationFrame(function(){ requestAnimationFrame(demarreVideo); });
    });

    /* Le focus va sur le CALQUE, pas sur le bouton. Un dialogue modal doit recevoir
       le focus, mais focus() sur le bouton fait peindre son anneau : Chrome traite un
       focus programmatique sans interaction préalable comme un focus clavier. Le
       client voyait donc son bouton cerclé de bleu sans avoir rien touché — ça se lit
       comme un état sélectionné, pas comme une invitation. Le calque, lui, n’a pas
       d’anneau, et la touche Tab mène ensuite au bouton. */
    intro.setAttribute('tabindex', '-1');
    setTimeout(function(){
      if (parti) return;
      try { intro.focus({ preventScroll: true }); } catch (e) {}
    }, reduce ? 0 : 900);

    function ferme(){
      if (parti) return;
      parti = true;
      if (vid) { try { vid.pause(); } catch (e) {} }
      window.removeEventListener('resize', auRedim);
      intro.classList.add('gen-sort');
      intro.setAttribute('aria-hidden', 'true');
      intro.style.pointerEvents = 'none';
      document.body.style.overflow = debordInitial;
      /* Le rapport démarre PENDANT que le calque monte : à 180 ms le voile est
         encore à environ 70 % et les premiers éléments se lèvent à travers. Sans ce
         recouvrement il y a un temps mort, et le rapport a l’air de repartir de zéro. */
      setTimeout(done, reduce ? 0 : 180);
      setTimeout(function(){
        if (vid) { vid.removeAttribute('src'); try { vid.load(); } catch (e) {} }
        if (url) { URL.revokeObjectURL(url); url = null; }
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, reduce ? 0 : 700);
    }

    /* Clic n’importe où — mais on ne punit pas la sélection de texte : vérifier
       l’orthographe d’un trait d’union dans son propre nom ne doit pas faire
       disparaître l’écran. */
    var x0 = 0, y0 = 0;
    intro.addEventListener('mousedown', function(e){ x0 = e.clientX; y0 = e.clientY; });
    intro.addEventListener('mouseup', function(e){
      if (Math.abs(e.clientX - x0) > 6 || Math.abs(e.clientY - y0) > 6) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel) !== '') return;
      ferme();
    });
    if (btn) btn.addEventListener('click', ferme);
    document.addEventListener('keydown', function onK(e){
      if (parti) { document.removeEventListener('keydown', onK); return; }
      var k = e.key;
      if (k === 'Escape' || k === 'Enter' || k === ' ' || k === 'Spacebar') {
        if (k === ' ' || k === 'Spacebar') e.preventDefault();
        document.removeEventListener('keydown', onK);
        ferme();
      }
    });
    // Aucune fermeture automatique : le carton attend le geste.
  }

  /* ═════════ Vos obligations : l'échéancier au clic ═════════
     Une seule obligation ouverte à la fois. Le détail est déjà dans la page —
     on ne fait que le montrer : le Ctrl+F du navigateur trouve donc un montant
     même quand la ligne est repliée, et l'impression sort tout.
     ⚠️ On pose « hidden », jamais display:none en ligne : la règle globale
     [hidden]{display:none!important} s'en charge, et l'attribut reste le seul
     état à lire. */
  qa('.ob-tete').forEach(function(bt){
    bt.addEventListener('click', function(){
      var id = bt.getAttribute('data-ob');
      var d = q('#ob-d-' + id);
      if (!d) return;
      var ouvert = bt.getAttribute('aria-expanded') === 'true';
      qa('.ob-tete').forEach(function(autre){
        if (autre === bt) return;
        autre.setAttribute('aria-expanded', 'false');
        var ad = q('#ob-d-' + autre.getAttribute('data-ob'));
        if (ad) ad.hidden = true;
      });
      bt.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
      d.hidden = ouvert;
      /* La frise déborde à droite quand l'échéance est lointaine : on la ramène
         au départ à chaque ouverture, sinon on rouvre sur un défilement laissé
         par la précédente. */
      if (!ouvert) {
        var f = q('.ob-frise', d);
        if (f) f.scrollLeft = 0;
      }
    });
  });

  /* ═════════ Le panneau d'un mois de revenu ═════════
     Cliquer une barre du calendrier explique CE mois : combien, de quoi, et par
     quel chemin l'argent arrive. Les textes viennent du module pur (testés) —
     ils ne sont pas réécrits ici. */
  (function(){
    var barres = qa('.bar[data-mois]');
    var panneau = q('#mois-p');
    if (!barres.length || !panneau) return;
    var titre = q('#mois-t'), chiffres = q('#mois-c'), etapes = q('#mois-e');
    var ferme = q('#mois-x');
    var data = [];
    try {
      var ilot = document.getElementById('mois-data');
      if (ilot) data = JSON.parse(ilot.textContent) || [];
    } catch (e) { data = []; }
    if (!data.length) return;

    var MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    var ouvert = -1;

    function cacher(){
      ouvert = -1;
      panneau.hidden = true;
      barres.forEach(function(b){ b.setAttribute('aria-expanded', 'false'); });
    }

    function montrer(i){
      var m = null;
      for (var k = 0; k < data.length; k++) if (data[k].index === i) m = data[k];
      if (!m) return;
      ouvert = i;
      barres.forEach(function(b){
        b.setAttribute('aria-expanded', Number(b.getAttribute('data-mois')) === i ? 'true' : 'false');
      });
      titre.textContent = MOIS[i] + (m.passe ? ' — déjà encaissé' : '');
      var lignes = [];
      if (m.dividendes > 0) lignes.push('Dividendes <b>' + money(m.dividendes) + '</b>');
      if (m.coupons > 0) lignes.push('Coupons <b>' + money(m.coupons) + '</b>');
      lignes.push('Total du mois <b>' + money(m.total) + '</b>');
      chiffres.innerHTML = lignes.join('');
      etapes.textContent = '';
      m.etapes.forEach(function(e){
        var li = document.createElement('li');
        var b = document.createElement('b');
        b.textContent = e.titre;
        var s = document.createElement('span');
        s.textContent = e.texte;
        li.appendChild(b); li.appendChild(s);
        etapes.appendChild(li);
      });
      panneau.hidden = false;
    }

    barres.forEach(function(b){
      b.addEventListener('click', function(){
        var i = Number(b.getAttribute('data-mois'));
        if (i === ouvert) { cacher(); return; }
        montrer(i);
      });
    });
    if (ferme) ferme.addEventListener('click', cacher);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && ouvert >= 0) cacher();
    });
  })();

  /* ═════════ Couvertures de chapitre épinglées ═════════
     Chaque piste reçoit une propriété --p de 0 à 1 : 0 quand son haut touche le
     haut de la fenêtre, 1 quand la piste a fini de défiler. Tout ce qui bouge sur
     une couverture s'en sert.

     Le calcul vit DANS le rAF unique du scroll-film — un seul écouteur de
     défilement pour tout le document, c'est la règle du fichier. On n'écrit la
     propriété que si elle a CHANGÉ d'un centième : réécrire une propriété
     personnalisée invalide le style de tout le sous-arbre, et une couverture
     immobile ne doit rien coûter. */
  var couvertures = qa('.couv');

  function majCouvertures(){
    for (var i = 0; i < couvertures.length; i++){
      var c = couvertures[i];
      var r = c.getBoundingClientRect();
      var course = r.height - window.innerHeight;
      var p = course > 0 ? clamp01(-r.top / course) : (r.top <= 0 ? 1 : 0);
      var arrondi = Math.round(p * 100) / 100;
      if (c.__p !== arrondi){
        c.__p = arrondi;
        c.style.setProperty('--p', String(arrondi));
      }
    }
  }

  /* « Tourner la page » : un clic n'importe où sur la couverture mène AU CONTENU
     du chapitre, jamais devant une page titre qu'il faudrait défiler. Quand le
     client interrompt avec « et mes comptes ? », le conseiller veut les cartes,
     pas le carton. */
  qa('[data-vers]').forEach(function(el){
    el.addEventListener('click', function(e){
      var cible = q('#' + el.getAttribute('data-vers'));
      if (!cible) return;
      e.stopPropagation();
      cible.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* La bascule de papier — OUTIL DE PROTOTYPE. Elle disparaît avec la décision. */
  (function(){
    var boite = q('#papier-bascule');
    if (!boite) return;
    qa('button', boite).forEach(function(b){
      b.addEventListener('click', function(){
        qa('button', boite).forEach(function(x){ x.classList.remove('est-actif'); });
        b.classList.add('est-actif');
        document.documentElement.setAttribute('data-papier', b.getAttribute('data-papier'));
      });
    });
  })();

  /* ═════════ Scroll-film ═════════
     Barre de progression en haut, rail de chapitres à droite, carton de chapitre
     qui passe, et légère parallaxe de l'aurore. UN SEUL écouteur de défilement et
     tout le travail dans un requestAnimationFrame : sur une page pleine de verre
     dépoli et de flous, un écouteur bavard se paie tout de suite en saccades. */
  (function(){
    var bar = q('#prog-bar');
    var fill = q('#rail-fill');
    var toast = q('#chap-toast');
    var dots = qa('.rail-dot');
    var anchors = dots.map(function(d){ return q('#' + d.getAttribute('data-go')); });
    var aurora = q('.aurora');
    if (!bar && !dots.length) return;

    var cur = 0, tid = null, ticking = false;

    /* Le chapitre courant est le DERNIER dont l'ancre est passée sous le tiers
       haut de la fenêtre : c'est ce que l'oeil considère comme « en lecture ».
       Exception au bas de page : le dernier chapitre (les mentions) est court et
       reste sous ce repère, donc il ne s'allumait JAMAIS. Quand on touche le fond,
       on est au dernier chapitre, point. */
    function chapterAt(y){
      if (y + window.innerHeight >= document.documentElement.scrollHeight - 4) return anchors.length - 1;
      var mark = y + window.innerHeight * 0.34, k = 0;
      for (var i = 0; i < anchors.length; i++){
        var a = anchors[i];
        if (a && a.getBoundingClientRect().top + y <= mark) k = i;
      }
      return k;
    }

    function showToast(i){
      if (!toast || reduce) return;
      var a = anchors[i];
      var lbl = a ? a.getAttribute('data-chap') : '';
      if (!lbl) return;
      toast.firstChild.textContent = lbl;
      toast.classList.add('on');
      if (tid) clearTimeout(tid);
      tid = setTimeout(function(){ toast.classList.remove('on'); }, 1700);
    }

    function frame(){
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = clamp01(y / max);
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
      if (fill) fill.style.height = (p * 100).toFixed(2) + '%';
      if (aurora && !reduce) aurora.style.setProperty('--par', (-y * 0.055).toFixed(1) + 'px');
      majCouvertures();
      var k = chapterAt(y);
      if (k !== cur){
        cur = k;
        dots.forEach(function(d, i){ d.classList.toggle('is-on', i === k); });
        showToast(k);
      }
    }
    function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    dots.forEach(function(d, i){
      d.addEventListener('click', function(){
        var a = anchors[i];
        if (!a) return;
        /* scrollIntoView plutôt qu'une position calculée à la main : l'offset était
           mesuré UNE FOIS, au clic, et le document continuait de bouger pendant le
           défilement doux — révélations qui se posent, sections qui grandissent. On
           arrivait alors à côté, de façon intermittente. Le décalage du haut vit
           maintenant dans le CSS (scroll-margin-top), là où le navigateur le
           réapplique tout seul. */
        a.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });
    // cur vaut déjà 0 : pas de carton de chapitre au chargement, il passerait
    // derrière le générique.
    frame();
  })();

  /* Les montants sont écrits EN CLAIR dans le balisage — le repli si le script
     n'aboutit pas. On les efface donc dès maintenant, AVANT le générique : le
     rapport est déjà en place sous le voile, et pendant que celui-ci se lève le
     client verrait sinon les montants apparaître en texte simple, disparaître, puis
     revenir en roulant. Un seul aller-retour de trop, mais bien visible. */
  if (!reduce) qa('[data-odo]').forEach(hideNow);

  runIntro(startChoreography);
  window.FILM = FILM;
})();
`.trim();
