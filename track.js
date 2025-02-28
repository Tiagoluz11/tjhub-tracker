(function () {
  // TJ 4.1
  let tjHub = window.tjHub || {};
  tjHub.dataLayer = window.dataLayer = window.dataLayer || [];

  function getSiteHost(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return "unknown";
    }
  }

  tjHub.site_id = getSiteHost(window.location.href);
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
    data.site_id = getSiteHost(window.location.href);
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

    tjHub.track('click', eventData);
  });

  window.tjHub = tjHub;
})();
