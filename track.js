(function () {
  // TJ 3.9 - Captura automática do site_id da URL do script
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];
  tjHub.site_id = 'UNKNOWN_SITE'; // Valor padrão antes de capturar da URL

  // 🔹 Captura o site_id da URL do script carregado
  function getSiteIdFromScript() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src.includes('tjhub-tracker.pages.dev/track.js')) {
        const urlParams = new URL(script.src).searchParams;
        const siteId = urlParams.get('site_id');
        if (siteId) {
          return siteId;
        }
      }
    }
    return null;
  }

  // 🔹 Define o site_id automaticamente se estiver na URL
  const detectedSiteId = getSiteIdFromScript();
  if (detectedSiteId) {
    tjHub.site_id = detectedSiteId;
  }

  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  let lastScrollPosition = 0;
  let scrollTimeout;

  // 🔹 Captura a posição do scroll
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

  // 🔹 Função para enviar eventos ao servidor
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

  // 🔹 Captura Page View
  tjHub.track('page_view');

  // 🔹 Captura Cliques em Botões e Links
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (!target) return;

    sendScrollEvent(); // Envia a posição do scroll antes de processar o clique

    let eventData = {
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className || '',
      id: target.id || '',
      href: target.href || ''
    };

    if (target.tagName.toLowerCase() === 'a' && target.hostname !== window.location.hostname) {
      // Se for um link externo, captura antes da saída
      eventData.external = true;
      tjHub.track('click_outbound', eventData);
      
      navigator.sendBeacon('https://tj-track-bd.tj-studio-ltda.workers.dev/', JSON.stringify({ events: [ { event: 'click_outbound', data: eventData } ] }));
    } else {
      // Se for interno, registra como clique normal
      tjHub.track('click', eventData);
    }
  });

  window.tjHub = tjHub;
})();
