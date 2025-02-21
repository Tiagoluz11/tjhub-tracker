(function () {
  //TJ 2.0
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

  // Captura Cliques em Botões e Links e também envia a última posição do scroll
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (target) {
      sendFinalScrollEvent(); // Envia a posição do scroll antes de processar o clique
      tjHub.track('click', {
        target: target.tagName.toLowerCase(),
        text: target.innerText.substring(0, 50),
        class: target.className || '',
        id: target.id || ''
      });
    }
  });

  // Captura Scroll Vertical apenas quando o usuário sair
  function sendFinalScrollEvent() {
    let scrollDepth = Math.round((lastScrollPosition / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    tjHub.track("vertical_scroll", {
      scroll_y: lastScrollPosition,
      scroll_percentage: scrollDepth,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: tjHub.session_id
    });
  }

  // Detecta saída no desktop (mouse saindo da tela superior)
  document.addEventListener("mouseleave", function (event) {
    if (event.clientY <= 0) {
      sendFinalScrollEvent();
    }
  });

  // Detecta botão "voltar" no mobile (Android e iOS)
  window.onpopstate = function () {
    sendFinalScrollEvent();
  };
  history.pushState({}, ''); // Impede saída imediata

  // Detecta gesto de saída no iOS (deslizar para trás)
  document.addEventListener("touchstart", function (e) {
    touchStartX = e.touches[0].clientX;
  });

  document.addEventListener("touchend", function (e) {
    let touchEndX = e.changedTouches[0].clientX;
    if (touchStartX < 20 && touchEndX > 80) {
      sendFinalScrollEvent();
    }
  });

  // Envia os dados quando o usuário sai da página
  window.addEventListener("beforeunload", sendFinalScrollEvent);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      sendFinalScrollEvent();
    }
  });

  window.tjHub = tjHub;
})();
