const MapView = {
  map: null, markers: [], lines: [], info: null, loading: false,

  load() {
    // 구글맵 SDK는 지도/지오코딩에만 필요. 실패해도 나머지 화면은 정상 동작
    if (window.google && google.maps) return;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_KEY}&libraries=places&callback=onMapsReady&loading=async`;
    s.async = true;
    s.onerror = () => { $('map').innerHTML = '<div class="empty-msg">지도를 불러오지 못했어요 (오프라인?)</div>'; };
    document.head.appendChild(s);
  },
  init() {
    this.map = new google.maps.Map($('map'), { zoom: 6, center: { lat: 36.0, lng: -118.0 }, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
    this.info = new google.maps.InfoWindow();
    this.applyTheme();
    this.update();
  },
  DARK: [{ elementType: 'geometry', stylers: [{ color: '#1e293b' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] }],
  applyTheme() { if (this.map) this.map.setOptions({ styles: Theme.isDark() ? this.DARK : null }); },
  icon(type, i) {
    const bg = type === 'sleep' ? '#2563eb' : type === 'flight' ? '#0891b2' : '#f59e0b', text = type === 'sleep' ? '🏠' : type === 'flight' ? '✈️' : i + 1, fs = (type === 'sleep' || type === 'flight') ? 14 : 18;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 36 48"><path fill="${bg}" stroke="#fff" stroke-width="2.5" d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z"/><text x="18" y="24" font-size="${fs}" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">${text}</text></svg>`;
    return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new google.maps.Size(32, 42), anchor: new google.maps.Point(16, 42) };
  },
  update() {
    if (!this.map) return;
    this.markers.forEach(m => m.setMap(null)); this.lines.forEach(l => l.setMap(null));
    this.markers = []; this.lines = [];
    const bounds = new google.maps.LatLngBounds(); let has = false;
    Store.trip.days.forEach(day => {
      if (!Schedule.isVisible(day.id)) return;
      const coords = [], places = Store.getPlaces(day.id);
      const ghostOf = n => ({ lat: n.lat + 1.5, lng: n.lng - 9 }); // 한국 같은 먼 곳은 서쪽 바다 쪽 가상 지점으로 표현
      const badge = (pos, text) => {
        const w = 18 + text.length * 13, svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><rect width="${w}" height="26" rx="13" fill="#0891b2" fill-opacity="0.95" stroke="#fff" stroke-width="2"/><text x="${w / 2}" y="18" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`;
        this.markers.push(new google.maps.Marker({ position: pos, map: this.map, zIndex: 95, icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), anchor: new google.maps.Point(w / 2, 13) } }));
      };
      places.forEach((p, i) => {
        if (p.far) {
          const nb = places.find((q, j) => j !== i && !q.far && q.lat != null && q.lng != null);
          if (!nb) return;
          const g = ghostOf(nb); coords.push(g); bounds.extend(g); has = true;
          badge(g, `✈️ ${p.farLabel || '먼 곳'}`);
          return;
        }
        if (p.lat == null || p.lng == null) return;
        const pos = { lat: p.lat, lng: p.lng };
        coords.push(pos); bounds.extend(pos); has = true;
        const m = new google.maps.Marker({ position: pos, map: this.map, icon: this.icon(p.type, i), title: p.name, zIndex: 100 });
        m.addListener('click', () => {
          const box = document.createElement('div');
          box.style.cssText = 'text-align:center;padding:5px;color:#0f172a';
          const b = document.createElement('b'); b.textContent = p.name;
          const sp = document.createElement('div'); sp.style.fontSize = '12px'; sp.textContent = day.label;
          box.append(b, sp);
          this.info.setContent(box); this.info.open(this.map, m);
        });
        this.markers.push(m);
        if (p.farNext) { const g = ghostOf(p); coords.push(g); bounds.extend(g); badge(g, `✈️ ${p.farNext}`); }
      });
      if (coords.length > 1) {
        this.lines.push(new google.maps.Polyline({ path: coords, geodesic: true, strokeColor: day.color, strokeOpacity: 0, strokeWeight: 3,
          icons: [{ icon: { path: 'M 0,-1 L 0,1', strokeOpacity: 0.8, scale: 3 }, offset: '0', repeat: '15px' }], map: this.map }));
        if (day.shortDrive) {
          const mid = { lat: (coords[0].lat + coords[coords.length - 1].lat) / 2, lng: (coords[0].lng + coords[coords.length - 1].lng) / 2 };
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="30"><rect width="160" height="30" rx="15" fill="#0f172a" fill-opacity="0.9" stroke="#fff" stroke-width="2"/><text x="80" y="20" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">🚗 ${day.shortDrive}</text></svg>`;
          this.markers.push(new google.maps.Marker({ position: mid, map: this.map, zIndex: 90,
            icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), anchor: new google.maps.Point(80, 15) } }));
        }
      }
    });
    if (has) {
      this.map.fitBounds(bounds);
      google.maps.event.addListenerOnce(this.map, 'idle', () => { if (this.map.getZoom() > 14) this.map.setZoom(14); });
    }
  },
  onShow() { if (this.map) { google.maps.event.trigger(this.map, 'resize'); this.update(); } }
};
window.onMapsReady = () => MapView.init();
