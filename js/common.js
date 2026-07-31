(function () {
  'use strict';

  window.showToast = function (message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.setTimeout(function () { toast.classList.remove('visible'); }, 2400);
  };
})();
