// 다크모드: 저장값 > 시스템 설정 순
const Theme = {
  isDark() { return document.documentElement.classList.contains('dark'); },
  init() { this.sync(); },
  toggle() {
    const dark = !this.isDark();
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('usTripTheme', dark ? 'dark' : 'light'); } catch (e) {}
    this.sync();
    if (window.MapView) MapView.applyTheme();
  },
  sync() { const b = $('btn-theme'); if (b) b.textContent = this.isDark() ? '☀️' : '🌙'; }
};
