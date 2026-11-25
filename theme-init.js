(function () {
  try {
    var r = JSON.parse(localStorage.getItem('cap_reglages')) || {};
    var palette = r.palette || 'bleu';
    var theme = r.theme || 'auto';
    if (theme === 'auto') {
      theme = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sombre' : 'clair';
    }
    document.documentElement.dataset.mode = palette + '-' + theme;
    var echelle = Number(r.echelle);
    if (echelle >= 0.8 && echelle <= 1.5) document.documentElement.style.setProperty('--echelle', echelle);
  } catch (e) {
    document.documentElement.dataset.mode = 'bleu-sombre';
  }
})();
