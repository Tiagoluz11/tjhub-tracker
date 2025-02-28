(function () {
  // Inicializa o TJ Tracker 5.0
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = tjHub.dataLayer || [];
  tjHub.site_id = tjHub.site_id || 'UNKNOWN_SITE';
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  let lastScrollPosition = 0;
  let scrollTimeout;

  // Captura a posição do scroll e envia após 3 segundos de inatividade
  window.addEventListener("scroll", function () {
    lastScrollPosition = window.scrollY;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(sendScrollEvent, 3000);
  });

  function sendScrollEvent() {
    tjHub.track("vertical_scroll", {
      scroll_y: lastScrollPosition,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: tjHub.session_id
    });
  }

  // Captura o host do cliente (domínio atual)
  tjHub.url_host = window.location.hostname;

  // Função para enviar eventos ao servidor
  tjHub.track = function (event, data = {}) {
    data.url = window.location.href;
    data.referrer = document.referrer;
    data.session_id = tjHub.session_id;
    data.site_id = tjHub.site_id;
    data.screen_size = `${window.innerWidth}x${window.innerHeight}`;
    data.device = navigator.userAgent;
    data.timestamp = new Date().toISOString();
    data.url_host = tjHub.url_host; // Adiciona o host do cliente

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

  // Captura Page View automaticamente
  tjHub.track('page_view');

  // Captura Cliques em Botões e Links
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (!target) return;

    sendScrollEvent(); // Envia a posição do scroll antes de processar o clique

    let eventData = {
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className || '',
      id: target.id || '',
      href: target.href || '',
      url_host: tjHub.url_host // Adiciona o host do cliente nos eventos de clique
    };

    if (target.tagName.toLowerCase() === 'a' && target.hostname !== window.location.hostname) {
      // Captura clique em links externos antes da saída
      eventData.external = true;
      tjHub.track('click_outbound', eventData);

      navigator.sendBeacon('https://tj-track-bd.tj-studio-ltda.workers.dev/', JSON.stringify({ events: [{ event: 'click_outbound', data: eventData }] }));
    } else {
      // Captura clique normal
      tjHub.track('click', eventData);
    }
  });

  window.tjHub = tjHub;
})();
