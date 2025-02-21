(function () {
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = tjHub.dataLayer || [];
  tjHub.site_id = tjHub.site_id || 'UNKNOWN_SITE';
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  // Captura movimentação do mouse
  document.addEventListener("mousemove", function (event) {
    tjHub.track("mouse_move", {
      x: event.clientX,
      y: event.clientY,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: tjHub.session_id
    });
  });

  // Captura cliques nos elementos
  document.addEventListener("click", function (event) {
    let target = event.target;
    tjHub.track("click", {
      x: event.clientX,
      y: event.clientY,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className,
      id: target.id,
      session_id: tjHub.session_id
    });
  });

  // Captura rolagem da página
  window.addEventListener("scroll", function () {
    let scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    tjHub.track("scroll", {
      depth: scrollDepth,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: tjHub.session_id
    });
  });

  // Função para armazenar os eventos localmente antes de enviar
  tjHub.track = function (event, data = {}) {
    data.url = window.location.href;
    data.referrer = document.referrer;
    data.timestamp = new Date().toISOString();
    data.site_id = tjHub.site_id;

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

  tjHub.track('page_view');
  window.tjHub = tjHub;
})();
