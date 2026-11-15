// Token Radar's page: one dataset in (window.RADAR, written beside this page),
// one board out. No fetch, no network, no imports. Every number on the page
// comes from board.json's own rows, so the page and the board cannot disagree.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D || !D.rows) { document.getElementById('meta').textContent = 'No radar data found beside this page.'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var rows = D.rows, live = D.live;
  var maxImplied = rows.length ? rows[0].implied_value_usd : 1;

  // ---- formatting -------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function trimNum(n, d) {
    var s = n.toFixed(d);
    while (s.indexOf('.') >= 0 && s.charAt(s.length - 1) === '0') s = s.slice(0, -1);
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }
  function money(n) {
    if (n == null) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + trimNum(n / 1e9, 2) + 'B';
    if (a >= 1e6) return '$' + trimNum(n / 1e6, 1) + 'M';
    if (a >= 1e3) return '$' + trimNum(n / 1e3, 1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    if (n == null) return '—';
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(v) {
    if (v == null) return { t: '—', c: 'flat' };
    var s = (v > 0 ? '+' : v < 0 ? '−' : '') + trimNum(Math.abs(v), 1) + '%';
    return { t: s, c: v > 0 ? 'up' : v < 0 ? 'down' : 'flat' };
  }
  function ageText(d) {
    if (d == null) return '—';
    if (d < 365) return d + 'd';
    return trimNum(d / 365, 1) + 'y';
  }
  function chainsText(ch) {
    if (!ch || !ch.length) return '—';
    return esc(ch[0]) + (ch.length > 1 ? ' +' + (ch.length - 1) : '');
  }
  function mult(n) { return '×' + trimNum(n, 4); }

  // ---- state -------------------------------------------------------------
  var state = { tab: 'pre', q: '', cat: '', chain: '', scope: 'all', sort: 'rank', dir: 1 };
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var k = decodeURIComponent(kv[0] || ''), v = decodeURIComponent(kv[1] || '');
      if (k === 'q') state.q = v;
      else if (k === 'cat') state.cat = v;
      else if (k === 'chain') state.chain = v;
      else if (k === 'scope') state.scope = v;
      else if (k === 'tab') state.tab = v === 'live' ? 'live' : 'pre';
      else if (k === 'p') state.open = v;
    }
  }
  function writeHash() {
    var p = [];
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.cat) p.push('cat=' + encodeURIComponent(state.cat));
    if (state.chain) p.push('chain=' + encodeURIComponent(state.chain));
    if (state.scope !== 'all') p.push('scope=' + state.scope);
    if (state.tab === 'live') p.push('tab=live');
    if (state.open) p.push('p=' + encodeURIComponent(state.open));
    history.replaceState(null, '', p.length ? '#' + p.join('&') : location.pathname + location.search);
  }

  // ---- header, stats, spotlight ------------------------------------------
  $('meta').textContent = 'Snapshot ' + D.as_of + ' · ' + D.source + ' · ' + D.board_size +
    ' pre-token protocols · model ' + D.model_version;
  var watchN = rows.filter(function (r) { return r.watchlist; }).length;
  $('stats').innerHTML =
    stat(money(D.total_implied_usd), 'total implied value across the board') +
    stat(String(watchN) + ' / ' + D.watchlist_size, 'watchlist protocols covered') +
    stat(String(D.board_size), 'pre-token rows · ' + D.beyond_size + ' beyond the watchlist') +
    stat(String(D.live_size), 'live-token protocols set aside');
  function stat(num, lbl) {
    return '<div class="stat"><div class="num">' + esc(num) + '</div><div class="lbl">' + esc(lbl) + '</div></div>';
  }
  $('spot').innerHTML = rows.slice(0, 10).map(function (r) {
    var w = Math.max(4, Math.round(r.implied_value_usd / maxImplied * 100));
    return '<article class="card" data-slug="' + esc(r.slug) + '" tabindex="0" role="button" aria-label="' + esc(r.name) + ' detail">' +
      '<div class="rank">#' + r.rank + (r.watchlist ? ' · WATCHLIST' : '') + '</div>' +
      '<div class="name">' + esc(r.name) + '</div>' +
      '<div class="val">' + money(r.implied_value_usd) + '</div>' +
      '<div class="bar"><i style="width:' + w + '%"></i></div>' +
      '<div class="sub">' + money(r.tvl_usd) + ' TVL · ' + esc(r.category || 'uncategorised') + '</div></article>';
  }).join('');

  // ---- filter controls -----------------------------------------------------
  function fillSelect(el, values) {
    var counts = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); });
    el.innerHTML = '<option value="">' + (el.id === 'cat' ? 'All categories' : 'All chains') + '</option>' +
      names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + ' (' + counts[n] + ')</option>'; }).join('');
  }
  fillSelect($('cat'), rows.map(function (r) { return r.category || 'uncategorised'; }));
  fillSelect($('chain'), rows.reduce(function (a, r) { return a.concat(r.chains); }, []));
  $('scope').options[0].text = 'All ' + D.board_size + ' rows';
  $('scope').options[1].text = 'Watchlist only (' + watchN + ')';
  $('scope').options[2].text = 'Beyond the watchlist (' + D.beyond_size + ')';

  // ---- filtering + sorting -------------------------------------------------
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.scope === 'watch' && !r.watchlist) return false;
      if (state.scope === 'beyond' && r.watchlist) return false;
      if (state.cat && (r.category || 'uncategorised') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortRows(list) {
    var k = state.sort, d = state.dir;
    var val = function (r) {
      if (k === 'name') return r.name.toLowerCase();
      if (k === 'chains') return r.chains.length;
      if (k === 'age_days') return r.age_days == null ? -1 : r.age_days;
      if (k === 'change_7d') return r.change_7d == null ? -999 : r.change_7d;
      return r[k];
    };
    return list.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -1 * d;
      if (x > y) return 1 * d;
      return a.slug < b.slug ? -1 : 1;
    });
  }
  function rowHtml(r) {
    var p = pct(r.change_7d);
    var w = Math.max(4, Math.round(r.implied_value_usd / maxImplied * 100));
    return '<tr data-slug="' + esc(r.slug) + '"><td class="num">#' + r.rank + '</td>' +
      '<td><b>' + esc(r.name) + '</b>' +
      (r.watchlist ? '<span class="pill watch">WATCHLIST</span>' : '<span class="pill beyond">BEYOND</span>') +
      '<span class="cat">' + esc(r.category || 'uncategorised') + '</span></td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + p.c + '">' + p.t + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td title="' + esc(r.chains.join(', ')) + '">' + chainsText(r.chains) + '</td>' +
      '<td class="num"><span class="bar-cell"><span class="bar"><i style="width:' + w + '%"></i></span>' +
      '<b>' + money(r.implied_value_usd) + '</b></span></td></tr>';
  }
  function render() {
    var isLive = state.tab === 'live';
    $('tabPre').setAttribute('aria-selected', String(!isLive));
    $('tabLive').setAttribute('aria-selected', String(isLive));
    $('board').hidden = isLive;
    $('live').hidden = !isLive;
    document.querySelector('.controls').style.display = isLive ? 'none' : '';
    if (isLive) {
      $('liveRows').innerHTML = live.map(function (r, i) {
        var p = pct(r.change_7d);
        return '<tr data-slug="' + esc(r.slug) + '"><td class="num">#' + (i + 1) + '</td>' +
          '<td><b>' + esc(r.name) + '</b><span class="pill token">TOKEN TRADES</span>' +
          '<span class="cat">' + esc(r.category || 'uncategorised') + '</span></td>' +
          '<td class="num">' + money(r.tvl_usd) + '</td>' +
          '<td class="num ' + p.c + '">' + p.t + '</td>' +
          '<td class="num">' + money(r.mcap_usd) + '</td>' +
          '<td title="' + esc(r.chains.join(', ')) + '">' + chainsText(r.chains) + '</td></tr>';
      }).join('');
      $('count').textContent = live.length + ' protocols that already trade — shown with the market’s own values, never ranked.';
      return;
    }
    var list = sortRows(filtered());
    $('rows').innerHTML = list.length ? list.map(rowHtml).join('') :
      '<tr><td colspan="7" class="empty">No protocol matches these filters.</td></tr>';
    $('count').textContent = list.length + ' of ' + rows.length + ' rows' +
      (state.scope === 'watch' ? ' · watchlist only' : state.scope === 'beyond' ? ' · beyond the watchlist' : '') +
      (state.q ? ' · matching “' + state.q + '”' : '');
    var ths = document.querySelectorAll('#board th');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var k = th.getAttribute('data-sort');
      th.classList.toggle('sorted', k === state.sort);
      th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (k === state.sort ? (state.dir === 1 ? ' ▲' : ' ▼') : '');
    }
  }

  // ---- detail dialog ---------------------------------------------------------
  var dlg = $('detail');
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) return;
    state.open = slug;
    var base = r.tvl_usd * D.model.base_multiple;
    var approx = base * r.growth_multiplier * r.maturity_multiplier * r.breadth_multiplier;
    var growthPct = Math.min(D.model.growth_cap, Math.max(D.model.growth_floor, r.change_7d == null ? 0 : r.change_7d));
    var steps = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*?)\s*Cost:\s*(.*?)\.\s*Time:\s*(.*?)\.?\s*$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + '<br><span class="cost">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    $('detailBody').innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      '<p class="sub">' + esc(r.category || 'uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      (r.watchlist ? ' · on the watchlist' : ' · beyond the watchlist') + '</p>' +
      '<div class="big">' + moneyFull(r.implied_value_usd) + '</div>' +
      '<div class="biglbl">implied value · model ' + esc(D.model_version) + '</div>' +
      '<table class="factors"><tbody>' +
      '<tr><td>TVL</td><td>' + moneyFull(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Base — TVL × ' + D.model.base_multiple + '</td><td>' + moneyFull(base) + '</td></tr>' +
      '<tr><td>Growth — 7d ' + (r.change_7d == null ? 'not listed' : pct(r.change_7d).t + ', clamped ' + growthPct + '%') + '</td><td>' + mult(r.growth_multiplier) + '</td></tr>' +
      '<tr><td>Maturity — ' + (r.age_days == null ? 'age not listed' : r.age_days + ' days live') + '</td><td>' + mult(r.maturity_multiplier) + '</td></tr>' +
      '<tr><td>Breadth — ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</td><td>' + mult(r.breadth_multiplier) + '</td></tr>' +
      '<tr><td class="eq">Implied value</td><td class="eq">≈ ' + moneyFull(approx) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="note">The factors above are rounded to four decimals and the board rounds its value from the ' +
      'full-precision factors, so the product here is approximate. The board’s value is ' + moneyFull(r.implied_value_usd) + '.</p>' +
      '<h3>Farm plan — 7 steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="note">This protocol records no token in the ' + D.as_of + ' snapshot. That is not proof it has none, ' +
      'and not a promise it will ever launch one.</p>';
    if (typeof dlg.showModal === 'function') dlg.showModal();
    writeHash();
  }
  dlg.addEventListener('close', function () { state.open = ''; writeHash(); });

  // ---- events ------------------------------------------------------------------
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); writeHash(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); writeHash(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); writeHash(); });
  $('scope').addEventListener('change', function (e) { state.scope = e.target.value; render(); writeHash(); });
  $('tabPre').addEventListener('click', function () { state.tab = 'pre'; render(); writeHash(); });
  $('tabLive').addEventListener('click', function () { state.tab = 'live'; render(); writeHash(); });
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = (k === 'rank' || k === 'name') ? 1 : -1; }
      render();
    });
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-slug]');
    if (t) openDetail(t.getAttribute('data-slug'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var t = e.target.closest && e.target.closest('[data-slug]');
      if (t) openDetail(t.getAttribute('data-slug'));
    }
  });

  // ---- init ----------------------------------------------------------------------
  readHash();
  $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('scope').value = state.scope;
  render();
  if (state.open) openDetail(state.open);
})();
