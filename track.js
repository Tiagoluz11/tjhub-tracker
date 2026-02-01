// Versão: 1.0.5 - Última atualização: 31/01/2026
// Alterações: Implementada trava anti-duplicidade em formulários e otimização de fila.

function getGaMeasurementId() {
      const scripts = document.getElementsByTagName('script');
      for (let script of scripts) {
            if (script.src && script.src.includes('track.js')) {
                  try {
                        const url = new URL(script.src, window.location.origin);
                        const gaId = url.searchParams.get('ga_id');
                        if (gaId) return gaId;
                  } catch (e) { }
            }
      }
      return null;
}

const gaMeasurementId = getGaMeasurementId();

(function () {
      window.dataLayer = window.dataLayer || [];
      var tjHub = window.tjHub || {};
      tjHub.queue = tjHub.queue || [];
      const TRACKING_ENDPOINT = "https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data";

      // --- Integração com GA4 ---
      function isGa4Available() {
            return typeof gtag !== 'undefined';
      }

      function sendGa4Event(eventName, eventParams) {
            if (isGa4Available()) {
                  try {
                        gtag("event", eventName, {
                              ...eventParams,
                              send_to: gaMeasurementId || "all",
                              non_interaction: eventName === "scroll" || eventName === "vertical_scroll"
                        });
                  } catch (error) {
                        console.error("[TJHub][GA4] Erro:", eventName, error);
                  }
            }
      }

      function getDeviceCategory() {
            const width = window.innerWidth;
            if (width <= 768) return "mobile";
            if (width <= 1024) return "tablet";
            return "desktop";
      }

      // --- IDs de Site e Sessão ---
      tjHub.site_id = (function () {
            const scripts = document.getElementsByTagName('script');
            for (let script of scripts) {
                  if (script.src.includes("site_id=")) {
                        try {
                              return new URL(script.src).searchParams.get("site_id");
                        } catch (e) { }
                  }
            }
            return "TJTJS2025";
      })();

      tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("tj_session_id", tjHub.session_id);

      const cookieHelper = {
            get: (name) => {
                  const value = `; ${document.cookie}`;
                  const parts = value.split(`; ${name}=`);
                  if (parts.length === 2) return parts.pop().split(';').shift();
                  return null;
            },
            getGaId: function () {
                  const gaCookie = this.get('_ga');
                  return gaCookie ? gaCookie.replace(/^GA1\.\d\./, '') : null;
            },
            getGaSession: function () {
                  const cookies = document.cookie.split(';');
                  for (let cookie of cookies) {
                        if (cookie.trim().startsWith('_ga_') && cookie.split('.').length > 2) {
                              return cookie.split('.')[2];
                        }
                  }
                  return null;
            }
      };

      function getMarketingData() {
            return {
                  utm_source: localStorage.getItem("tj_utm_source"),
                  utm_medium: localStorage.getItem("tj_utm_medium"),
                  utm_campaign: localStorage.getItem("tj_utm_campaign"),
                  utm_content: localStorage.getItem("tj_utm_content"),
                  utm_term: localStorage.getItem("tj_utm_term"),
                  gclid: localStorage.getItem("tj_gclid"),
                  fbclid: localStorage.getItem("tj_fbclid"),
                  ga_client_id: cookieHelper.getGaId(),
                  ga_session_id: cookieHelper.getGaSession(),
                  fbp: cookieHelper.get('_fbp'),
                  fbc: cookieHelper.get('_fbc')
            };
      }

      (function captureMarketingParams() {
            const params = new URLSearchParams(window.location.search);
            const marketingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
            marketingKeys.forEach(key => {
                  if (params.has(key)) localStorage.setItem("tj_" + key, params.get(key));
            });
      })();

      // --- Scroll Tracking ---
      let maxScrollDepth = 0;
      let maxScrollEventSent = false;
      let lastSentScrollDepth = 0;
      let scrollFocusTimer = null;
      let pendingScrollEventData = null;

      window.addEventListener("scroll", function () {
            const totalHeight = Math.max(
                  document.body.scrollHeight, document.documentElement.scrollHeight,
                  document.body.offsetHeight, document.documentElement.offsetHeight,
                  document.body.clientHeight, document.documentElement.clientHeight
            ) - window.innerHeight;

            const currentDepth = totalHeight > 0 ? Math.round((window.scrollY / totalHeight) * 100) : 0;

            if (currentDepth > maxScrollDepth) {
                  maxScrollDepth = currentDepth;
                  const roundedDepth = Math.floor(currentDepth / 10) * 10;
                  if (roundedDepth > lastSentScrollDepth) {
                        lastSentScrollDepth = roundedDepth;
                        pendingScrollEventData = {
                              scroll_y: window.scrollY,
                              scroll_depth: roundedDepth,
                              max_scroll_depth: maxScrollDepth,
                              screen_size: `${window.innerWidth}x${window.innerHeight}`,
                              session_id: tjHub.session_id,
                              page_path: window.location.pathname,
                              device_category: getDeviceCategory()
                        };
                        if (scrollFocusTimer) clearTimeout(scrollFocusTimer);
                        if (document.visibilityState === 'visible') {
                              scrollFocusTimer = setTimeout(function () {
                                    if (pendingScrollEventData) {
                                          tjHub.track("vertical_scroll", pendingScrollEventData);
                                          sendGa4Event("vertical_scroll", {
                                                scroll_depth: pendingScrollEventData.scroll_depth,
                                                page_path: pendingScrollEventData.page_path,
                                                device_category: pendingScrollEventData.device_category
                                          });
                                          pendingScrollEventData = null;
                                    }
                              }, 5000);
                        }
                  }
            }
      }, { passive: true });

      function triggerScrollEvent() {
            if (!maxScrollEventSent && maxScrollDepth > 0) {
                  const eventData = {
                        max_scroll_depth: maxScrollDepth,
                        page_path: window.location.pathname,
                        device_category: getDeviceCategory()
                  };
                  tjHub.track("scroll_depth_max", eventData);
                  sendGa4Event("scroll_depth", {
                        max_scroll_depth: maxScrollDepth,
                        page_path: window.location.pathname,
                        device_category: getDeviceCategory()
                  });
                  maxScrollEventSent = true;
            }
      }

      document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') triggerScrollEvent();
      });
      window.addEventListener('pagehide', triggerScrollEvent);

      // --- Core Tracking Logic ---
      function flushQueue() {
            if (tjHub.sending) {
                  clearTimeout(tjHub.sending);
                  tjHub.sending = null;
            }

            if (tjHub.queue.length > 0) {
                  const eventsToSend = tjHub.queue.slice();
                  tjHub.queue = [];
                  const payload = JSON.stringify({ events: eventsToSend });
                  const url = `${TRACKING_ENDPOINT}?site_id=${tjHub.site_id}`;

                  if (navigator.sendBeacon) {
                        navigator.sendBeacon(url, payload);
                  } else {
                        fetch(url, { method: "POST", body: payload, keepalive: true });
                  }
            }
      }

      window.addEventListener('pagehide', flushQueue);

      tjHub.track = function (eventName, data = {}) {
            data.url = window.location.href;
            data.referrer = document.referrer;
            data.session_id = tjHub.session_id;
            data.site_id = tjHub.site_id;
            data.screen_size = `${window.innerWidth}x${window.innerHeight}`;
            data.device = navigator.userAgent;
            data.device_category = getDeviceCategory();
            data.timestamp = new Date().toISOString();

            tjHub.queue.push({ event: eventName, data: data });

            if (!tjHub.sending) {
                  tjHub.sending = setTimeout(flushQueue, 5000);
            }
      };

      // 1. Page View
      tjHub.track("page_view");
      sendGa4Event("page_view", {
            page_path: window.location.pathname,
            page_title: document.title,
            device_category: getDeviceCategory()
      });

      // 2. Click Tracking
      document.addEventListener("click", function (event) {
            const clickX = event.pageX;
            const clickY = event.pageY;
            const clickXPercent = Math.round((event.clientX / window.innerWidth) * 100);
            const clickYPercent = Math.round((event.clientY / window.innerHeight) * 100);
            const closestInteractiveElement = event.target.closest("a, button");

            if (!closestInteractiveElement) {
                  tjHub.track("heatmap_click", {
                        click_x: clickX, click_y: clickY,
                        click_x_percent: clickXPercent, click_y_percent: clickYPercent,
                        page_path: window.location.pathname,
                        target: event.target.tagName.toLowerCase(),
                        class: event.target.className || "",
                        id: event.target.id || "",
                        device_category: getDeviceCategory()
                  });
                  return;
            }

            let clickData = {
                  target: closestInteractiveElement.tagName.toLowerCase(),
                  text: closestInteractiveElement.innerText ? closestInteractiveElement.innerText.substring(0, 50) : "",
                  class: closestInteractiveElement.className || "",
                  id: closestInteractiveElement.id || "",
                  href: closestInteractiveElement.href || "",
                  click_x: clickX, click_y: clickY,
                  page_path: window.location.pathname,
                  device_category: getDeviceCategory()
            };

            if (closestInteractiveElement.tagName.toLowerCase() === "a" && closestInteractiveElement.hostname !== window.location.hostname) {
                  tjHub.track("click_outbound", clickData);
                  flushQueue(); // Envio imediato para links externos
                  sendGa4Event("click_outbound", {
                        link_url: closestInteractiveElement.href,
                        page_path: window.location.pathname
                  });
            } else {
                  tjHub.track("click", clickData);
            }
      });

      // 3. Form Submission com Trava Anti-Duplicidade
      document.addEventListener("submit", function (event) {
            const form = event.target;
            if (!form || form.tagName.toLowerCase() !== "form") return;
            if (form.getAttribute("data-track") !== "true") return;

            // Trava para evitar duplo envio
            if (form.getAttribute("data-tj-processing") === "true") return;
            form.setAttribute("data-tj-processing", "true");

            let formData = new FormData(form);
            let formFields = {};
            let leadInfo = { nome: null, email: null, tel: null };

            for (let [key, value] of formData.entries()) {
                  if (typeof key === "string" && !key.toLowerCase().includes("senha")) {
                        formFields[key] = value;
                        let lowerKey = key.toLowerCase();
                        if (!leadInfo.nome && (lowerKey.includes("nome") || lowerKey.includes("name"))) leadInfo.nome = value;
                        else if (!leadInfo.email && lowerKey.includes("mail")) leadInfo.email = value;
                        else if (!leadInfo.tel && (lowerKey.includes("tel") || lowerKey.includes("cel") || lowerKey.includes("whats"))) leadInfo.tel = value;
                  }
            }

            const submitData = {
                  tag: form.getAttribute("data-tag") || "Form Site",
                  action: form.action || "",
                  form_id: form.id || "",
                  fields: formFields,
                  lead_info: leadInfo,
                  marketing: getMarketingData(),
                  page_path: window.location.pathname,
                  device_category: getDeviceCategory()
            };

            tjHub.track("form_submit", submitData);
            sendGa4Event("form_submit", { form_id: submitData.form_id, page_path: window.location.pathname });

            // Se o formulário não recarregar a página (AJAX), liberamos após 3s para novo envio
            setTimeout(() => form.removeAttribute("data-tj-processing"), 3000);
      });

      window.tjHub = tjHub;
})();