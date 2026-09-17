/* Default clean light theme script */
(function () {
  var root = document.documentElement;
  try {
    localStorage.removeItem('olla_theme');
    root.removeAttribute('data-theme');
  } catch (e) {}
})();
