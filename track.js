(function () {
  // TJ 5.6
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];
  tjHub.site_id = 'UNKNOWN_SITE';

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

  tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("tj_session_id", tjHub.session_id);

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
        navigator.sendBeacon(`https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data?site_id=${tjHub.site_id}`, JSON.stringify({ events: eventsToSend }));
        tjHub.sending = null;
      }, 5000);
    }
  };

  tjHub.track('page_view');

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

  // 🔹 Captura envios de formulário com data-track="true"
  document.addEventListener("submit", function (event) {
    const form = event.target;
    if (!form || form.tagName.toLowerCase() !== "form") return;

    // Só rastreia formulários com atributo data-track="true"
    if (form.getAttribute("data-track") !== "true") return;

    let formData = new FormData(form);
    let formFields = {};
    for (let [key, value] of formData.entries()) {
      if (typeof key === 'string' && key.toLowerCase().includes('senha')) continue;
      formFields[key] = value;
    }

    tjHub.track("form_submit", {
      action: form.action || '',
      method: form.method || 'GET',
      form_id: form.id || '',
      form_class: form.className || '',
      fields: formFields
    });
  });

  window.tjHub = tjHub;
})();
