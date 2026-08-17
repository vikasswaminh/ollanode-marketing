/* Light-first theme with a persisted manual toggle. Loaded from <head> so the
   pre-paint runs before first render (CSP script-src 'self' — must be external). */
(function () {
  var root = document.documentElement;
  try {
    if (localStorage.getItem('olla_theme') === 'dark') root.setAttribute('data-theme', 'dark');
  } catch (e) {}

  function bind() {
    var btn = document.getElementById('theme');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      try { localStorage.setItem('olla_theme', next); } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
