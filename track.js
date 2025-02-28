(function () {
  // TJ 4.2
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];

  // Captura o customer_id da URL do script
  function getCustomerIdFromScript() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src.includes('tjhub-tracker.pages.dev/track.js')) {
        const urlParams = new URL(script.src).searchParams;
        return urlParams.get('customer_id') || null;
      }
    }
    return null;
  }

  // Captura automaticamente o domínio do site (site_id)
  function getSiteIdFromLocation() {
    return window.location.hostname.replace("www.", ""); // Remove o 'www.'
  }

  // Define os valores corretamente
  tjHub.customer_id = getCustomerIdFromScript(); // Prioriza o customer_id da URL do script
  tjHub.site_id = getSiteIdFromLocation(); // Usa o domínio como site_id

  // Gera um session_id único
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  // Função de rastreamento de eventos
  tjHub.track = function (event, data = {}) {
    data.url = window.location.href;
    data.referrer = document.referrer;
    data.session_id = tjHub.session_id;
    data.customer_id = tjHub.customer_id;
    data.site_id = tjHub.site_id;
    data.screen_size = `${window.innerWidth}x${window.innerHeight}`;
    data.device = navigator.userAgent;
    data.timestamp = new Date().toISOString();

    tjHub.dataLayer.push({ event, data });

    if (!tjHub.sending) {
      tjHub.sending = setTimeout(() => {
        let eventsToSend = tjHub.dataLayer.slice();
        tjHub.dataLayer = [];
        navigator.sendBeacon(`https://tj-track-bd.tj-studio-ltda.workers.dev/`, JSON.stringify({ events: eventsToSend }));
        tjHub.sending = null;
      }, 5000);
    }
  };

  // Captura Page View automaticamente
  tjHub.track('page_view');

  window.tjHub = tjHub;
})();
