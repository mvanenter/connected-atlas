(() => {
  'use strict';

  const config = window.MAP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

  const demo = [
    { nickname: 'PacificMapper', country: 'Canada', continent: 'North America', latitude: 49.3, longitude: -123.1, note: 'Hello from the Pacific coast!' },
    { nickname: 'AtlasFriend', country: 'Brazil', continent: 'South America', latitude: -23.5, longitude: -46.6, note: 'Olá from São Paulo!' },
    { nickname: 'CapeCarto', country: 'South Africa', continent: 'Africa', latitude: -33.9, longitude: 18.4, note: 'Sawubona from Cape Town!' },
    { nickname: 'GeoBonjour', country: 'France', continent: 'Europe', latitude: 48.9, longitude: 2.4, note: 'Bonjour from Paris!' },
    { nickname: 'CityMapper', country: 'Japan', continent: 'Asia', latitude: 35.7, longitude: 139.7, note: 'こんにちは from Tokyo!' },
    { nickname: 'SouthernHello', country: 'New Zealand', continent: 'Oceania', latitude: -43.5, longitude: 172.6, note: 'Kia ora from Christchurch!' }
  ];

  const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';
  let contributions = [];

  const map = L.map('map', {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 10,
    preferCanvas: false,
    zoomControl: true
  }).setView([15, 8], 2);

  map.attributionControl.addAttribution('Country boundaries: Natural Earth (public domain)');

  const geography = L.geoJSON(null, {
    interactive: false,
    style: {
      color: '#35d5e8',
      weight: 0.95,
      opacity: 0.92,
      fillColor: '#0b2a36',
      fillOpacity: 0.95,
      className: 'atlas-country-lines'
    }
  }).addTo(map);

  const boundaryGlow = L.geoJSON(null, {
    interactive: false,
    style: {
      color: '#67f3ff',
      weight: 1.8,
      opacity: 0.32,
      fillOpacity: 0,
      className: 'atlas-coast-glow'
    }
  }).addTo(map);

  const graticule = L.layerGroup().addTo(map);
  for (let lat = -60; lat <= 60; lat += 30) {
    const coordinates = [];
    for (let lon = -180; lon <= 180; lon += 3) coordinates.push([lat, lon]);
    L.polyline(coordinates, {
      color: '#2a6677',
      weight: 0.55,
      opacity: 0.18,
      interactive: false,
      className: 'atlas-graticule'
    }).addTo(graticule);
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    L.polyline([[-83, lon], [83, lon]], {
      color: '#2a6677',
      weight: 0.55,
      opacity: 0.18,
      interactive: false,
      className: 'atlas-graticule'
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
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map).bringToBack();
    }
  }
  loadWorld();

  const connections = L.layerGroup().addTo(map);
  const marks = L.featureGroup().addTo(map);

  function setStatus(value) {
    $('map-status').textContent = value;
  }

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

  const continentLookup = {
    'new zealand': 'Oceania', 'australia': 'Oceania', 'papua new guinea': 'Oceania', 'fiji': 'Oceania',
    'japan': 'Asia', 'china': 'Asia', 'india': 'Asia', 'thailand': 'Asia', 'singapore': 'Asia', 'indonesia': 'Asia',
    'france': 'Europe', 'united kingdom': 'Europe', 'germany': 'Europe', 'italy': 'Europe', 'spain': 'Europe',
    'brazil': 'South America', 'argentina': 'South America', 'chile': 'South America', 'colombia': 'South America',
    'canada': 'North America', 'united states': 'North America', 'usa': 'North America', 'mexico': 'North America',
    'south africa': 'Africa', 'kenya': 'Africa', 'nigeria': 'Africa', 'egypt': 'Africa',
    'antarctica': 'Antarctica'
  };

  function inferContinent(country, continent) {
    const explicit = clean(continent, 35);
    if (explicit) return explicit;
    return continentLookup[clean(country, 65).toLowerCase()] || '';
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
      const country = clean(row[column('country')], 65);
      const continent = inferContinent(country, column('continent') >= 0 ? row[column('continent')] : '');
      return {
        nickname: clean(row[column('nickname')], 45),
        country,
        latitude: latRaw ? Number(latRaw) : NaN,
        longitude: lonRaw ? Number(lonRaw) : NaN,
        note: clean(column('greeting') >= 0 ? row[column('greeting')] : (column('note') >= 0 ? row[column('note')] : ''), 200),
        continent
      };
    }).filter(d => d.nickname && d.country && Number.isFinite(d.latitude) &&
      Number.isFinite(d.longitude) && Math.abs(d.latitude) <= 90 && Math.abs(d.longitude) <= 180);
  }

  function popupContent(d) {
    const root = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'popup-title';
    title.textContent = d.nickname;
    root.append(title);

    const country = document.createElement('div');
    country.className = 'popup-country';
    country.textContent = d.country;
    root.append(country);

    if (d.note) {
      const note = document.createElement('div');
      note.className = 'popup-note';
      note.textContent = d.note;
      root.append(note);
    }
    return root;
  }

  function buildCurvedArc(a, b, heightScale = 0.16) {
    let lon1 = a.longitude;
    let lon2 = b.longitude;
    if (Math.abs(lon2 - lon1) > 180) {
      if (lon1 < lon2) lon1 += 360;
      else lon2 += 360;
    }

    const dx = lon2 - lon1;
    const dy = b.latitude - a.latitude;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const mx = (lon1 + lon2) / 2;
    const my = (a.latitude + b.latitude) / 2;

    const nx = distance === 0 ? 0 : -dy / distance;
    const ny = distance === 0 ? 0 : dx / distance;
    const curvature = Math.min(28, Math.max(8, distance * heightScale));
    const cx = mx + nx * curvature;
    const cy = my + ny * curvature;

    const points = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const oneMinus = 1 - t;
      const lon = (oneMinus * oneMinus * lon1) + (2 * oneMinus * t * cx) + (t * t * lon2);
      const lat = (oneMinus * oneMinus * a.latitude) + (2 * oneMinus * t * cy) + (t * t * b.latitude);
      let finalLon = lon;
      if (finalLon > 180) finalLon -= 360;
      if (finalLon < -180) finalLon += 360;
      points.push([lat, finalLon]);
    }
    return points;
  }

  function addConnections(locations) {
    connections.clearLayers();
    if (locations.length < 2) return;

    const ordered = locations.slice(0, 40);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      const points = buildCurvedArc(a, b, 0.16);

      L.polyline(points, {
        color: '#52f2ff',
        opacity: 0.20,
        weight: 5,
        interactive: false,
        smoothFactor: 1,
        className: 'atlas-connection-glow'
      }).addTo(connections);

      L.polyline(points, {
        color: '#77fbff',
        opacity: 0.46,
        weight: 1.6,
        interactive: false,
        smoothFactor: 1,
        className: 'atlas-connection-core'
      }).addTo(connections);
    }
  }

  function addMarker(position, data) {
    const halo = L.circleMarker(position, {
      radius: 14,
      stroke: false,
      fillColor: '#4cf4ff',
      fillOpacity: 0.10,
      className: 'atlas-marker-halo'
    });
    halo.bindPopup(popupContent(data));
    marks.addLayer(halo);

    const pulse = L.circleMarker(position, {
      radius: 8,
      color: '#65fbff',
      weight: 1.2,
      opacity: 0.95,
      fillColor: '#34dff2',
      fillOpacity: 0.22,
      className: 'atlas-marker-pulse'
    });
    pulse.bindPopup(popupContent(data));
    marks.addLayer(pulse);

    const circle = L.circle(position, {
      radius: config.radiusMetres || 10000,
      color: '#41f1ff',
      fillColor: '#29d7ea',
      weight: 1.3,
      opacity: 0.72,
      fillOpacity: 0.08,
      className: 'atlas-marker-radius'
    });
    circle.bindPopup(popupContent(data));
    marks.addLayer(circle);

    const core = L.circleMarker(position, {
      radius: 4.5,
      color: '#f3ffff',
      weight: 1.0,
      opacity: 1,
      fillColor: '#9cfeff',
      fillOpacity: 1,
      className: 'atlas-marker-core'
    });
    core.bindPopup(popupContent(data));
    marks.addLayer(core);
  }

  function render() {
    const q = $('search').value.trim().toLowerCase();
    const visible = contributions.filter(d => [d.nickname, d.country, d.note].some(x => x.toLowerCase().includes(q)));

    marks.clearLayers();
    addConnections(visible);
    visible.forEach(d => addMarker([d.latitude, d.longitude], d));

    $('stat-mappers').textContent = contributions.length.toLocaleString();
    $('stat-countries').textContent = new Set(contributions.map(d => d.country.toLowerCase())).size.toLocaleString();
    const continentCount = new Set(contributions.map(d => clean(d.continent).toLowerCase()).filter(Boolean)).size;
    $('stat-continents').textContent = continentCount ? String(continentCount) : '—';

    const emptyState = $('empty-state');
    emptyState.hidden = !!visible.length;
    if (!visible.length) {
      emptyState.textContent = contributions.length === 0
        ? '🌍 The world is waiting for its first hello! Be the first to add your city and greeting.'
        : 'No matching places yet. Try another search.';
    }

    if (visible.length && q) map.fitBounds(marks.getBounds().pad(.35), { maxZoom: 6 });
  }

  async function load() {
    if (previewMode) {
      contributions = demo;
      $('demo-banner').hidden = false;
      $('demo-banner').textContent = 'PREVIEW ONLY — Six fictional sample contributors. Not real submissions.';
      setStatus('Preview mode · sample locations only');
      render();
      return;
    }

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
      setStatus(contributions.length ? `${contributions.length} contributions loaded · refreshes periodically` : 'No approved contributions yet');
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
