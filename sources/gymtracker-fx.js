(function () {
  'use strict';
  /* Couche d'animations GymTracker. Ne touche pas aux données : lit le DOM rendu par React
     et ajoute indicateur glissant, sens des transitions, sorties animées, état "scrollé". */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAV_IDS = { 'Programmes': 'programs', 'Séance': 'session', 'Stats': 'stats', 'Exercices': 'library', 'Profil': 'profile' };
  var TAB_ORDER = ['programs', 'session', 'stats', 'library', 'profile'];
  var PARENT = { program: 'programs', builder: 'programs', history: 'stats' };
  var DEPTH = { program: 1, builder: 1, history: 1 };
  var lastPill = null;      // {x, w} dernière position connue de l'indicateur
  var lastActive = null;    // onglet actif précédent
  var lastScreen = null;    // écran précédent
  var lastScreenEl = null;

  function readScreen() {
    try {
      var raw = localStorage.getItem('gymtracker_last_screen_v1');
      var r = JSON.parse(raw);
      return (r && r.screen) || raw || null;
    } catch (e) { return null; }
  }

  function labelOf(btn) {
    for (var i = 0; i < btn.childNodes.length; i++) {
      var n = btn.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) return n.textContent.trim();
    }
    return '';
  }

  function placePill(nav) {
    var pill = nav.querySelector('.nav-pill');
    var fresh = false;
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'nav-pill';
      pill.setAttribute('aria-hidden', 'true');
      nav.insertBefore(pill, nav.firstChild);
      fresh = true;
    }
    var active = null;
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) {
      var id = NAV_IDS[labelOf(b)];
      if (id && b.getAttribute('data-nav') !== id) b.setAttribute('data-nav', id);
      if (b.classList.contains('on')) active = b;
    });
    if (!active) { pill.style.opacity = '0'; return; }
    pill.style.opacity = '1';
    var x = active.offsetLeft, w = active.offsetWidth;
    var id = active.getAttribute('data-nav');
    if (fresh && lastPill && !reduce) {
      // La nav est remontée à chaque changement d'écran (Error Boundary keyé) :
      // FLIP depuis l'ancienne position pour garder la continuité du mouvement.
      pill.classList.add('no-anim');
      pill.style.width = lastPill.w + 'px';
      pill.style.transform = 'translateX(' + lastPill.x + 'px)';
      void pill.offsetWidth;
      pill.classList.remove('no-anim');
    } else if (fresh) {
      pill.classList.add('no-anim');
      requestAnimationFrame(function () { pill.classList.remove('no-anim'); });
    }
    pill.style.width = w + 'px';
    pill.style.transform = 'translateX(' + x + 'px)';
    if (lastActive && lastActive !== id) {
      active.classList.add('fx-bump');
      setTimeout(function () { active.classList.remove('fx-bump'); }, 700);
    }
    lastPill = { x: x, w: w };
    lastActive = id;
  }

  function tabIndex(s) { return TAB_ORDER.indexOf(PARENT[s] || s); }

  function onNewScreen(el) {
    if (el === lastScreenEl) return;
    lastScreenEl = el;
    var s = readScreen();
    var dir = 'none';
    if (lastScreen && s && s !== lastScreen) {
      var a = tabIndex(lastScreen), b = tabIndex(s);
      if (a === b) dir = (DEPTH[s] || 0) >= (DEPTH[lastScreen] || 0) ? 'fwd' : 'back';
      else if (a >= 0 && b >= 0) dir = b > a ? 'fwd' : 'back';
    }
    document.documentElement.setAttribute('data-dir', dir);
    lastScreen = s;
    updateScrolled();
  }

  var layer = null;
  function getLayer() {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div');
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:160';
      document.body.appendChild(layer);
    }
    return layer;
  }
  function animateOut(node, zIndex) {
    if (reduce) return;
    node.classList.add('fx-leaving');
    node.inert = true;
    var host = getLayer();
    host.style.zIndex = zIndex;
    host.appendChild(node);
    var done = false;
    var kill = function () { if (!done) { done = true; node.remove(); } };
    node.addEventListener('animationend', function (e) { if (e.target === node || e.target.classList.contains('sheet')) kill(); });
    setTimeout(kill, 600);
  }

  var obs = new MutationObserver(function (records) {
    var addedTimer = false, removedTimer = null, removedBackdrops = [];
    records.forEach(function (r) {
      Array.prototype.forEach.call(r.addedNodes, function (n) {
        if (n.nodeType !== 1 || n.closest('.fx-leaving')) return;
        if (n.matches('.timer') || n.querySelector('.timer')) addedTimer = true;
      });
      Array.prototype.forEach.call(r.removedNodes, function (n) {
        if (n.nodeType !== 1 || n.classList.contains('fx-leaving')) return;
        if (n.matches('.backdrop')) removedBackdrops.push(n);
        else if (n.matches('.timer')) removedTimer = n;
      });
    });
    removedBackdrops.forEach(function (n) { animateOut(n, 150); });
    if (removedTimer && !addedTimer) animateOut(removedTimer, 95);

    var nav = document.querySelector('#root .nav');
    if (nav) placePill(nav);
    var scr = document.querySelector('#root .screen, #root .welcome');
    if (scr) onNewScreen(scr);
  });

  function updateScrolled() {
    document.documentElement.classList.toggle('fx-scrolled', window.scrollY > 24);
  }

  function start() {
    var root = document.getElementById('root');
    if (!root) return;
    obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    obs.observe(document.body, { childList: true });
    window.addEventListener('scroll', updateScrolled, { passive: true });
    window.addEventListener('resize', function () {
      var nav = document.querySelector('#root .nav');
      if (nav) { var p = nav.querySelector('.nav-pill'); if (p) p.classList.add('no-anim'); placePill(nav); if (p) requestAnimationFrame(function () { p.classList.remove('no-anim'); }); }
    });
    var nav = document.querySelector('#root .nav');
    if (nav) placePill(nav);
    var scr = document.querySelector('#root .screen, #root .welcome');
    if (scr) onNewScreen(scr);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
