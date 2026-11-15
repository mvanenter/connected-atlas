(() => {
  'use strict';

  const config = window.MAP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

  // Keep existing form, CSV and data-column contracts unchanged.
  const demo = [
    { nickname: 'Sample A', country: 'New Zealand', latitude: -43.5, longitude: 172.6, note: 'Demo location only.' },
    { nickname: 'Sample B', country: 'Japan', latitude: 35.7, longitude: 139.7, note: 'Demo location only.' },
    { nickname: 'Sample C', country: 'France', latitude: 48.9, longitude: 2.4, note: 'Demo location only.' },
    { nickname: 'Sample D', country: 'Brazil', latitude: -23.5, longitude: -46.6, note: 'Demo location only.' },
    { nickname: 'Sample E', country: 'Canada', latitude: 49.3, longitude: -123.1, note: 'Demo location only.' },
    { nickname: 'Sample F', country: 'South Africa', latitude: -33.9, longitude: 18.4, note: 'Demo location only.' }
  ];

  let contributions = [];
  const map = L.map('map', {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 10,
    preferCanvas: false
  }).setView([16, 10], 2);

  map.attributionControl.addAttribution('Country boundaries: Natural Earth (public domain)');

  // The basemap uses local vector data, so there is no paid tile API key.
  const geography = L.geoJSON(null, {
    interactive: false,
    style: {
      color: '#247f93',
      weight: 0.65,
      opacity: 0.65,
      fillColor: '#0b2531',
      fillOpacity: 0.92,
      className: 'atlas-country-lines'
    }
  }).addTo(map);

  // A second, unfilled line layer gives coast/country outlines a gentle glow.
  const boundaryGlow = L.geoJSON(null, {
    interactive: false,
    style: {
      color: '#20cce3',
      weight: 0.85,
      opacity: 0.30,
      fillOpacity: 0,
      className: 'atlas-coast-glow'
    }
  }).addTo(map);

  // Very subtle latitude/longitude reference lines.
  const graticule = L.layerGroup().addTo(map);
  for (let lat = -60; lat <= 60; lat += 30) {
    const coordinates = [];
    for (let lon = -180; lon <= 180; lon += 3) coordinates.push([lat, lon]);
    L.polyline(coordinates, { color: '#2a6677', weight: 0.55, opacity: 0.22, interactive: false }).addTo(graticule);
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    L.polyline([[-83, lon], [83, lon]], {
      color: '#2a6677', weight: 0.55, opacity: 0.22, interactive: false
    }).addTo(graticule);
  }
  graticule.bringToBack?.();

  async function loadWorld() {
    try {
      const response = await fetch('world.geojson');
      if (!response.ok) throw new Error('World boundaries HTTP ' + response.status);
      const data = await response.json();
      if (data.type !== 'FeatureCollection') throw new Error('Invalid world boundary dataset');
      geography.addData(data);
      boundaryGlow.addData(data);
    } catch (error) {
      console.error('Cannot load local world boundaries:', error);
      // Graceful fallback: still show a usable map, without requiring a key.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
      }).addTo(map).bringToBack();
    }
  }
  loadWorld();

  const connections = L.layerGroup().addTo(map);
  const marks = L.featureGroup().addTo(map);

  function setStatus(value) { $('map-status').textContent = value; }

  function parseCSV(csv) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (quoted) {
        if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && csv[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value.trim())) rows.push(row);
        row = []; field = '';
      } else field += ch;
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }

  function normalize(rows) {
    if (!rows.length) return [];
    const header = rows.shift().map(x => x.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const column = name => header.indexOf(name);
    if (['nickname', 'country', 'latitude', 'longitude'].some(key => column(key) < 0)) {
      throw new Error('Published CSV must have nickname, country, latitude, longitude headers.');
    }
    return rows.map(row => {
      const latRaw = clean(row[column('latitude')]);
      const lonRaw = clean(row[column('longitude')]);
      return {
        nickname: clean(row[column('nickname')], 45),
        country: clean(row[column('country')], 65),
        latitude: latRaw ? Number(latRaw) : NaN,
        longitude: lonRaw ? Number(lonRaw) : NaN,
        note: clean(column('greeting') >= 0 ? row[column('greeting')] :
          (column('note') >= 0 ? row[column('note')] : ''), 200),
        continent: clean(column('continent') >= 0 ? row[column('continent')] : '', 35)
      };
    }).filter(d => d.nickname && d.country && Number.isFinite(d.latitude) &&
      Number.isFinite(d.longitude) && Math.abs(d.latitude) <= 90 && Math.abs(d.longitude) <= 180);
  }

  function popupContent(d) {
    // textContent, not innerHTML: protect visitors from user-submitted HTML.
    const root = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'popup-title'; title.textContent = d.nickname; root.append(title);
    const country = document.createElement('div');
    country.className = 'popup-country'; country.textContent = d.country; root.append(country);
    if (d.note) {
      const note = document.createElement('div');
      note.className = 'popup-note'; note.textContent = d.note; root.append(note);
    }
    return root;
  }

  function addConnections(locations) {
    connections.clearLayers();
    if (locations.length < 2) return;
    // Visual metaphor for collaboration, not verified social relationships.
    // Connect up to 40 contributions, avoiding anti-meridian wrapping artefacts.
    const ordered = locations.slice(0, 40);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1], b = ordered[i];
      if (Math.abs(a.longitude - b.longitude) > 180) continue;
      const points = [];
      const steps = 24;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const lat = a.latitude + (b.latitude - a.latitude) * t;
        const lon = a.longitude + (b.longitude - a.longitude) * t;
        points.push([lat, lon]);
      }
      L.polyline(points, {
        color: '#34e0ee', opacity: .22, weight: 1.2, interactive: false,
        className: 'atlas-connection'
      }).addTo(connections);
    }
  }

  function render() {
    const q = $('search').value.trim().toLowerCase();
    const visible = contributions.filter(d =>
      [d.nickname, d.country, d.note].some(x => x.toLowerCase().includes(q)));
    marks.clearLayers();
    addConnections(visible);
    visible.forEach(d => {
      const position = [d.latitude, d.longitude];
      const circle = L.circle(position, {
        radius: config.radiusMetres || 10000,
        color: '#33e9ef', fillColor: '#1ccbdd', weight: 1.2,
        opacity: .85, fillOpacity: .16, className: 'atlas-marker-halo'
      });
      circle.bindPopup(popupContent(d));
      marks.addLayer(circle);
      const dot = L.circleMarker(position, {
        radius: 5, color: '#d6ffff', weight: 1,
        fillColor: '#44f6ff', fillOpacity: 1, className: 'atlas-marker-core'
      });
      dot.bindPopup(popupContent(d));
      marks.addLayer(dot);
    });
    $('stat-mappers').textContent = contributions.length.toLocaleString();
    $('stat-countries').textContent = new Set(contributions.map(d => d.country.toLowerCase())).size.toLocaleString();
    const count = new Set(contributions.map(d => d.continent.toLowerCase()).filter(Boolean)).size;
    $('stat-continents').textContent = count ? String(count) : '—';
    $('empty-state').hidden = !!visible.length;
    if (visible.length && q) map.fitBounds(marks.getBounds().pad(.4), { maxZoom: 6 });
  }

  async function load() {
    if (!config.csvUrl) {
      contributions = config.showDemoIfNotConfigured ? demo : [];
      $('demo-banner').hidden = !config.showDemoIfNotConfigured;
      setStatus('Preview mode · example locations');
      render();
      return;
    }
    $('demo-banner').hidden = true;
    setStatus('Checking for contributions…');
    try {
      const url = new URL(config.csvUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
        throw new Error('Use a Google Sheets published HTTPS CSV link.');
      }
      url.searchParams.set('_', String(Date.now()));
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Google Sheets responded with HTTP ' + response.status);
      contributions = normalize(parseCSV(await response.text()));
      render();
      setStatus(contributions.length
        ? `${contributions.length} contributions loaded · refreshes periodically`
        : 'No approved contributions yet');
    } catch (error) {
      console.error('Cannot load published CSV:', error);
      setStatus('Could not load contributions · check CSV link / publishing settings');
    }
  }

  if (config.formUrl && /^https:\/\//.test(config.formUrl)) {
    const link = $('join-link');
    link.href = config.formUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.classList.remove('disabled');
    link.removeAttribute('aria-disabled');
  } else {
    $('join-link').title = 'Add the public Google Form link in config.js to activate this button';
  }
  $('refresh').addEventListener('click', load);
  $('search').addEventListener('input', render);
  load();
  setInterval(load, Math.max(30000, Number(config.refreshMilliseconds) || 90000));
})();
