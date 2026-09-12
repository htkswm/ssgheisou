/* ナビの「記録」ドロップダウンを、タップ／キーボードでも開閉できるようにする。
   タブレット（ホバー不可）対策。デスクトップの hover も従来どおり効く。 */
(function () {
  function closeAll(except) {
    document.querySelectorAll('.dropdown.open').forEach(function (dd) {
      if (dd === except) return;
      dd.classList.remove('open');
      var t = dd.querySelector('span');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.dropdown').forEach(function (dd) {
    var trig = dd.querySelector('span');
    if (!trig) return;
    trig.setAttribute('role', 'button');
    trig.setAttribute('tabindex', '0');
    trig.setAttribute('aria-haspopup', 'true');
    trig.setAttribute('aria-expanded', 'false');

    function toggle(force) {
      var open = (force === undefined) ? !dd.classList.contains('open') : force;
      closeAll(dd);
      dd.classList.toggle('open', open);
      trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    trig.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    trig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape') { toggle(false); }
    });
  });

  // メニュー外をタップ／クリックしたら閉じる
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dropdown')) closeAll(null);
  });
})();
