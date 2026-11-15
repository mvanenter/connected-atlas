(() => {
  'use strict';
  const config = window.MAP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const demo = [
    { nickname: 'Sample A', country: 'New Zealand', latitude: -43.5, longitude: 172.6, note: 'Demo location only.' },
    { nickname: 'Sample B', country: 'Japan', latitude: 35.7, longitude: 139.7, note: 'Demo location only.' },
    { nickname: 'Sample C', country: 'France', latitude: 48.9, longitude: 2.4, note: 'Demo location only.' },
    { nickname: 'Sample D', country: 'Brazil', latitude: -23.5, longitude: -46.6, note: 'Demo location only.' },
    { nickname: 'Sample E', country: 'Canada', latitude: 49.3, longitude: -123.1, note: 'Demo location only.' },
    { nickname: 'Sample F', country: 'South Africa', latitude: -33.9, longitude: 18.4, note: 'Demo location only.' }
  ];
  // Demo is visible only before configuration; it is never mixed with real submissions.
  let contributions = [];
  const map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 13 }).setView([15, 15], 2);
  
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

  const marks = L.featureGroup().addTo(map);
  const continents = {
    // Country list below is deliberately indicative for the COUNTRIES represented in demo only;
    // for real contributions continents are derived from a user-supplied optional 'continent' column.
  };
  function setStatus(str) { $('map-status').textContent = str; }
  function parseCSV(csv) {
    // RFC 4180-style parser: quoted commas, escaped quotes and multiline fields.
    const rows = []; let row = [], field = '', quotes = false;
    for (let i=0; i<csv.length; i++) {
      const c=csv[i];
      if (quotes) { if(c==='"' && csv[i+1]==='"') {field+='"';i++;} else if(c==='"'){quotes=false;} else {field+=c;} }
      else if(c==='"') quotes=true;
      else if(c===',') {row.push(field);field='';}
      else if(c==='\n'||c==='\r') {if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
      else field+=c;
    }
    row.push(field);if(row.some(v=>v.trim()))rows.push(row);
    return rows;
  }
  const clean = (s, max=120) => String(s ?? '').trim().slice(0,max);
  function normalize(rows) {
    if (!rows.length) return [];
    const header=rows.shift().map(x=>x.trim().toLowerCase().replace(/[^a-z]/g,''));
    const column=(name)=>header.indexOf(name);
    if (['nickname','country','latitude','longitude'].some(k=>column(k)<0)) throw new Error('The published sheet must have nickname, country, latitude, longitude headers.');
    return rows.map(row => {
      const latRaw=String(row[column('latitude')] ?? '').trim();const lonRaw=String(row[column('longitude')] ?? '').trim();
      const latitude=latRaw ? Number(latRaw) : NaN;const longitude=lonRaw ? Number(lonRaw) : NaN;
      const nickname=clean(row[column('nickname')],45);const country=clean(row[column('country')],65);
      const note=column('greeting')>=0?clean(row[column('greeting')],200):(column('note')>=0?clean(row[column('note')],200):'');
      const continent=column('continent')>=0?clean(row[column('continent')],35):'';
      return {nickname,country,latitude,longitude,note,continent};
    }).filter(d=>d.nickname&&d.country&&Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)&&d.latitude>=-90&&d.latitude<=90&&d.longitude>=-180&&d.longitude<=180);
  }
  function safeText(el, text){el.textContent=text;return el;}
  function popupContent(d){
    const root=document.createElement('div');
    const n=document.createElement('div');n.className='popup-title';safeText(n,d.nickname);root.append(n);
    const c=document.createElement('div');c.className='popup-country';safeText(c,d.country);root.append(c);
    if(d.note){const p=document.createElement('div');p.className='popup-note';safeText(p,d.note);root.append(p);}
    return root;
  }
  function render(){
    const q=$('search').value.trim().toLowerCase();
    const visible=contributions.filter(d=>[d.nickname,d.country,d.note].some(s=>s.toLowerCase().includes(q)));
    marks.clearLayers();
    visible.forEach(d=>{
      const circle=L.circle([d.latitude,d.longitude],{radius:config.radiusMetres||10000,color:'#166a57',fillColor:'#28a27c',weight:1.5,opacity:.85,fillOpacity:.22});
      circle.bindPopup(popupContent(d));marks.addLayer(circle);
      const dot=L.circleMarker([d.latitude,d.longitude],{radius:4,color:'#fff',weight:1.5,fillColor:'#14674f',fillOpacity:1});
      dot.bindPopup(popupContent(d));marks.addLayer(dot);
    });
    $('stat-mappers').textContent=contributions.length.toLocaleString();
    $('stat-countries').textContent=new Set(contributions.map(d=>d.country.toLowerCase())).size.toLocaleString();
    const numContinents=new Set(contributions.map(d=>d.continent.toLowerCase()).filter(Boolean)).size;
    $('stat-continents').textContent=numContinents?String(numContinents):'—';
    $('empty-state').hidden=!!visible.length;
    if (visible.length && q) map.fitBounds(marks.getBounds().pad(.4), {maxZoom:6});
  }
  async function load(){
    if(!config.csvUrl){
      contributions=config.showDemoIfNotConfigured?demo:[];
      $('demo-banner').hidden=!config.showDemoIfNotConfigured;
      setStatus('Preview mode · example locations');render();return;
    }
    $('demo-banner').hidden=true;setStatus('Checking for contributions…');
    try{
      const url=new URL(config.csvUrl);
      if(url.protocol!=='https:' || url.hostname!=='docs.google.com')throw new Error('Use a Google Sheets published HTTPS CSV link.');
      url.searchParams.set('_',String(Date.now()));
      const response=await fetch(url.toString(), {cache:'no-store'});
      if(!response.ok)throw new Error('Google Sheets responded with HTTP '+response.status);
      const data=normalize(parseCSV(await response.text()));
      contributions=data; render();
      setStatus(data.length?`${data.length} contributions loaded · refreshes periodically`:'No approved contributions yet');
    }catch(e){
      console.error('Cannot load published CSV:',e);
      setStatus('Could not load contributions · check CSV link / publishing settings');
    }
  }
  if(config.formUrl && /^https:\/\//.test(config.formUrl)){
    const a=$('join-link');a.href=config.formUrl;a.target='_blank';a.rel='noopener noreferrer';a.classList.remove('disabled');a.removeAttribute('aria-disabled');
  } else {$('join-link').title='Add the public Google Form link in config.js to activate this button';}
  $('refresh').addEventListener('click',load);
  $('search').addEventListener('input',render);
  load();setInterval(load,Math.max(30000,Number(config.refreshMilliseconds)||90000));
})();
