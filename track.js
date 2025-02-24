(function () {
  // TJ 3.4 - Captura eventos internos e externos corretamente
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = tjHub.dataLayer || [];
  tjHub.site_id = tjHub.site_id || 'UNKNOWN_SITE';
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  let lastScrollPosition = 0;
  let scrollTimeout;

  // Captura a posição do scroll sempre que o usuário rolar
  window.addEventListener("scroll", function () {
    lastScrollPosition = window.scrollY;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(sendScrollEvent, 3000); // Envia após 3 segundos de inatividade
  });

  function sendScrollEvent() {
    tjHub.track("vertical_scroll", {
      scroll_y: lastScrollPosition,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: tjHub.session_id
    });
  }

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

  // Captura Cliques em Botões e Links Internos/Externos
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (!target) return;

    sendScrollEvent(); // Envia a posição do scroll antes de processar o clique

    let isExternal = target.tagName.toLowerCase() === 'a' && target.hostname !== window.location.hostname;

    let eventData = {
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className || '',
      id: target.id || '',
      href: target.href || '',
      external: isExternal
    };

    if (isExternal) {
      event.preventDefault(); // Apenas para links externos
      tjHub.track('click_outbound', eventData);
      setTimeout(() => {
        window.location.href = target.href; // Aguarda o envio do evento antes de redirecionar
      }, 400);
    } else {
      tjHub.track('click', eventData);
    }
  });

  window.tjHub = tjHub;
})();
