// 날씨 (OpenWeatherMap 현재 날씨). 실패 시 마지막 성공값을 캐시에서 표시
const Weather = {
  async load() {
    const bar = $('weather-bar');
    const results = await Promise.all(CONFIG.WEATHER_CITIES.map(async city => {
      try {
        const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city.query)}&appid=${CONFIG.OWM_API_KEY}&units=metric&lang=kr`);
        const d = await r.json();
        if (d.cod !== 200) return null;
        return { name: city.name, temp: Math.round(d.main.temp), icon: d.weather[0].icon };
      } catch (e) { return null; }
    }));
    let items = results.filter(Boolean);
    let stale = false;
    if (items.length) LS.set('usTripWeather', items);
    else { items = LS.get('usTripWeather', []); stale = items.length > 0; }

    if (!items.length) { bar.innerHTML = '<div class="weather-msg">날씨 정보를 불러오지 못했습니다.</div>'; return; }
    bar.innerHTML = items.map(w => `
      <div class="weather-widget"><b>${esc(w.name)}</b>
        <img src="https://openweathermap.org/img/wn/${esc(w.icon)}.png" alt="" style="width:28px;height:28px;margin:0 -4px;">
        <span>${w.temp}°C</span></div>`).join('') + (stale ? '<div class="weather-msg">(저장된 값)</div>' : '');
  }
};
