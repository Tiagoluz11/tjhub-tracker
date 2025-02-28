(function () {
  // 🔹 TJ 4.3 - Rastreio otimizado e seguro
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];

  // 📌 Captura automaticamente o customer_id da URL do script carregado
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

  // 📌 Captura automaticamente o domínio do site (site_id)
  function getSiteIdFromLocation() {
    return window.location.hostname.replace("www.", ""); // Remove o 'www.'
  }

  // 🔹 Define customer_id e site_id corretamente
  tjHub.customer_id = getCustomerIdFromScript(); // Obtém da URL do script
  tjHub.site_id = getSiteIdFromLocation(); // Obtém do hostname do site

  // 🔹 Gera um session_id único para cada usuário
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  // 🔹 Captura eventos de clique automaticamente
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (!target) return;

    let eventData = {
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className || '',
      id: target.id || '',
      href: target.href || ''
    };

    if (target.tagName.toLowerCase() === 'a' && target.hostname !== window.location.hostname) {
      // 🔹 Se for um link externo, captura como "click_outbound"
      eventData.external = true;
      tjHub.track('click_outbound', eventData);
      
      // Usa sendBeacon para evitar bloqueios na navegação
      navigator.sendBeacon(`https://tj-track-bd.tj-studio-ltda.workers.dev/`, JSON.stringify({ events: [{ event: 'click_outbound', data: eventData }] }));
    } else {
      // 🔹 Se for um clique interno, registra normalmente
      tjHub.track('click', eventData);
    }
  });

  // 🔹 Função para rastrear eventos e enviar para o servidor
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

  // 🔹 Captura Page View automaticamente
  tjHub.track('page_view');

  // 🔹 Exibe no console para depuração
  console.log("TJ Tracker Iniciado ✅", {
    customer_id: tjHub.customer_id,
    site_id: tjHub.site_id,
    session_id: tjHub.session_id
  });

  window.tjHub = tjHub;
})();
