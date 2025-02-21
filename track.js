(function () {
  //TJ 2.5
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = tjHub.dataLayer || [];
  tjHub.site_id = tjHub.site_id || 'UNKNOWN_SITE';
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  let lastScrollPosition = 0;
  let touchStartX = 0;

  // Captura a posição do scroll sempre que o usuário rolar
  window.addEventListener("scroll", function () {
    lastScrollPosition = window.scrollY;
  });

  // Função para enviar eventos ao servidor
  tjHub.track = function (event, data = {}) {
    data.url = window.location.href;
    data.referrer = document.referrer;
    data.session_id = tjHub.session_id;
    data.site_id = tjHub.site_id;
    data.screen_size = `${window.innerWidth}x${window.innerHeight}`;
    data.device = navigator.userAgent;
    data.timestamp = new Date().toISOString();

    tjHub.dataLayer.push({ event, data });

    if (!tjHub.sending) {
      tjHub.sending = setTimeout(() => {
        let eventsToSend = tjHub.dataLayer.slice();
        tjHub.dataLayer = [];
        navigator.sendBeacon('https://tj-track-bd.tj-studio-ltda.workers.dev/', JSON.stringify({ events: eventsToSend }));
        tjHub.sending = null;
      }, 5000);
    }
  };

  // Captura Page View
  tjHub.track('page_view');

  // Detecta saída no desktop (mouse saindo da tela superior)
  document.addEventListener("mouseleave", function (event) {
    if (event.clientY <= 0) {
      tjHub.track("vertical_scroll", { scroll_y: lastScrollPosition, screen_size: `${window.innerWidth}x${window.innerHeight}`, session_id: tjHub.session_id });
    }
  });

  // Detecta botão "voltar" no mobile (Android e iOS)
  window.onpopstate = function () {
    tjHub.track("vertical_scroll", { scroll_y: lastScrollPosition, screen_size: `${window.innerWidth}x${window.innerHeight}`, session_id: tjHub.session_id });
  };
  history.pushState({}, ''); // Impede saída imediata

  // Detecta gesto de saída no iOS (deslizar para trás)
  document.addEventListener("touchstart", function (e) {
    touchStartX = e.touches[0].clientX;
  });

  document.addEventListener("touchend", function (e) {
    let touchEndX = e.changedTouches[0].clientX;
    if (touchStartX < 20 && touchEndX > 80) {
      tjHub.track("vertical_scroll", { scroll_y: lastScrollPosition, screen_size: `${window.innerWidth}x${window.innerHeight}`, session_id: tjHub.session_id });
    }
  });

  // Envia os dados quando o usuário sai da página
  window.addEventListener("beforeunload", function () {
    tjHub.track("vertical_scroll", { scroll_y: lastScrollPosition, screen_size: `${window.innerWidth}x${window.innerHeight}`, session_id: tjHub.session_id });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      tjHub.track("vertical_scroll", { scroll_y: lastScrollPosition, screen_size: `${window.innerWidth}x${window.innerHeight}`, session_id: tjHub.session_id });
    }
  });

  window.tjHub = tjHub;
})();
