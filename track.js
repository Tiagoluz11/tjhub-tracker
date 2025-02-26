(function () {
  // TJ 3.8 - Integração com dataLayer para capturar site_id corretamente
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];
  tjHub.site_id = 'UNKNOWN_SITE'; // Valor padrão antes de capturar da dataLayer
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  let lastScrollPosition = 0;
  let scrollTimeout;

  // 🔹 Função para processar o dataLayer e capturar site_id
  function processaDataLayer() {
    for (let item of tjHub.dataLayer) {
      if (Array.isArray(item) && item[0] === 'config' && item[1].site_id) {
        tjHub.site_id = item[1].site_id;
      }
    }
  }

  // 🔹 Captura eventos do dataLayer e processa site_id dinamicamente
  function tjtag() {
    let args = Array.from(arguments);
    tjHub.dataLayer.push(args);
    
    if (args[0] === 'config' && args[1].site_id) {
      tjHub.site_id = args[1].site_id;
    }
  }

  window.tjtag = tjtag;
  
  // 🔹 Processa dataLayer após um pequeno delay para garantir que os dados tenham sido carregados
  setTimeout(processaDataLayer, 500);

  // 🔹 Captura a posição do scroll sempre que o usuário rolar
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
