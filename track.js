(function () {
  // TJ 5.7 - Com Rastreamento de Campanhas (UTM/GCLID)
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];
  tjHub.site_id = 'UNKNOWN_SITE';

  // 1. Identifica o Site ID pelo Script
  function getSiteIdFromScript() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src.includes('tjhub-tracker.pages.dev/track.js')) {
        const urlParams = new URL(script.src).searchParams;
        return urlParams.get('site_id') || 'UNKNOWN_SITE';
      }
    }
    return 'UNKNOWN_SITE';
  }

  tjHub.site_id = getSiteIdFromScript();

  // 2. Gerenciamento de Sessão
  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

  // 3. CAPTURA DE CAMPANHAS (Novo)
  // Captura UTMs, GCLID e FBCLID da URL e persiste no navegador
  function captureCampaignParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const keysToTrack = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
    
    let hasNewData = false;
    keysToTrack.forEach(key => {
      if (urlParams.has(key)) {
        localStorage.setItem('tj_' + key, urlParams.get(key));
        hasNewData = true;
      }
    });

    // Se houver novos dados de campanha, atualiza o timestamp
    if (hasNewData) {
        localStorage.setItem('tj_campaign_time', new Date().toISOString());
    }
  }

  // Executa imediatamente ao carregar
  captureCampaignParams();

  // Função para recuperar os dados de campanha salvos
  function getCampaignData() {
      return {
          utm_source: localStorage.getItem('tj_utm_source') || null,
          utm_medium: localStorage.getItem('tj_utm_medium') || null,
          utm_campaign: localStorage.getItem('tj_utm_campaign') || null,
          utm_content: localStorage.getItem('tj_utm_content') || null,
          utm_term: localStorage.getItem('tj_utm_term') || null,
          gclid: localStorage.getItem('tj_gclid') || null,
          fbclid: localStorage.getItem('tj_fbclid') || null
      };
  }

  // 4. Rastreamento de Scroll
  let lastScrollPosition = 0;
  let scrollTimeout;

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

  // 5. Função Principal de Tracking (Envio em Lote)
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
        // Envia para o Worker da Cloudflare
        navigator.sendBeacon(`https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data?site_id=${tjHub.site_id}`, JSON.stringify({ events: eventsToSend }));
        tjHub.sending = null;
      }, 5000);
    }
  };

  // Dispara page_view inicial
  tjHub.track('page_view');

  // 6. Rastreamento de Cliques
  document.addEventListener("click", function (event) {
    const target = event.target.closest('a, button');
    if (!target) return;

    sendScrollEvent();

    let eventData = {
      target: target.tagName.toLowerCase(),
      text: target.innerText.substring(0, 50),
      class: target.className || '',
      id: target.id || '',
      href: target.href || ''
    };

    if (target.tagName.toLowerCase() === 'a' && target.hostname !== window.location.hostname) {
      eventData.external = true;
      tjHub.track('click_outbound', eventData);
      navigator.sendBeacon(`https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data?site_id=${tjHub.site_id}`, JSON.stringify({ events: [{ event: 'click_outbound', data: eventData }] }));
    } else {
      tjHub.track('click', eventData);
    }
  });

  // 7. Rastreamento de Formulários (Atualizado com Marketing Data)
  document.addEventListener("submit", function (event) {
    const form = event.target;
    if (!form || form.tagName.toLowerCase() !== "form") return;

    // Só rastreia formulários com atributo data-track="true"
    if (form.getAttribute("data-track") !== "true") return;

    let formData = new FormData(form);
    let formFields = {};
    for (let [key, value] of formData.entries()) {
      // Ignora campos de senha por segurança
      if (typeof key === 'string' && key.toLowerCase().includes('senha')) continue;
      formFields[key] = value;
    }

    // Pega os dados de campanha persistidos
    const marketingData = getCampaignData();

    tjHub.track("form_submit", {
      action: form.action || '',
      method: form.method || 'GET',
      form_id: form.id || '',
      form_class: form.className || '',
      fields: formFields,
      marketing: marketingData // 🔥 DADOS DE CAMPANHA AQUI
    });
  });

  window.tjHub = tjHub;
})();