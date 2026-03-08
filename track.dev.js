// Versão: 2.0.0 - Última atualização: 08/03/2026
// Alterações:
// - Eventos de comportamento (scroll, click, heatmap) enviados APENAS para GA4
// - Somente form_submit é enviado para Cloudflare D1 (leads)
// - Removidos console.logs de produção
// - Corrigido vazamento de listener visibilitychange dentro do scroll handler
// - Adicionado throttle no scroll handler (200ms)
// - Adicionado TTL de sessão (30 min)
// - Removido envio duplicado em click_outbound

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

      // Endpoint do Cloudflare Worker — usado SOMENTE para envio de leads (form_submit).
      const TRACKING_ENDPOINT = "https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data";

      // --- Integração com GA4 ---

      function isGa4Available() {
            return typeof gtag !== 'undefined';
      }

      /**
       * Envia um evento para o GA4 via gtag.
       * Eventos de comportamento (scroll, click, heatmap) vão APENAS por aqui.
       */
      function sendGa4Event(eventName, eventParams) {
            if (!isGa4Available()) return;
            try {
                  gtag("event", eventName, {
                        ...eventParams,
                        send_to: gaMeasurementId || "all",
                        non_interaction: eventName === "scroll" || eventName === "vertical_scroll"
                  });
            } catch (error) {
                  // Silencioso em produção
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

      // Sessão com TTL de 30 minutos
      const SESSION_TTL = 30 * 60 * 1000;
      (function initSession() {
            const storedSession = localStorage.getItem("tj_session_id");
            const storedTimestamp = parseInt(localStorage.getItem("tj_session_ts") || "0", 10);
            const now = Date.now();

            if (storedSession && (now - storedTimestamp) < SESSION_TTL) {
                  tjHub.session_id = storedSession;
            } else {
                  tjHub.session_id = `sess_${now}_${Math.random().toString(36).substr(2, 9)}`;
            }
            localStorage.setItem("tj_session_id", tjHub.session_id);
            localStorage.setItem("tj_session_ts", String(now));
      })();

      // --- Cookies ---

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

      // --- Marketing ---

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
            ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(function (key) {
                  if (params.has(key)) localStorage.setItem("tj_" + key, params.get(key));
            });
      })();

      // --- Scroll Tracking (SOMENTE GA4) ---
      // Usa throttle para evitar layout thrashing.

      let maxScrollDepth = 0;
      let maxScrollEventSent = false;
      let lastSentScrollDepth = 0;
      let scrollFocusTimer = null;
      let pendingScrollEventData = null;
      let scrollThrottleTimer = null;

      function handleScroll() {
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
                              scroll_depth: roundedDepth,
                              max_scroll_depth: maxScrollDepth,
                              page_path: window.location.pathname,
                              device_category: getDeviceCategory()
                        };
                        if (scrollFocusTimer) {
                              clearTimeout(scrollFocusTimer);
                              scrollFocusTimer = null;
                        }
                        if (document.visibilityState === 'visible') {
                              scrollFocusTimer = setTimeout(function () {
                                    if (pendingScrollEventData) {
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
      }

      // Scroll handler com throttle de 200ms
      window.addEventListener("scroll", function () {
            if (!scrollThrottleTimer) {
                  scrollThrottleTimer = setTimeout(function () {
                        scrollThrottleTimer = null;
                        handleScroll();
                  }, 200);
            }
      }, { passive: true });

      // Listener de visibilitychange para scroll — FORA do scroll handler (corrige leak)
      document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible' && scrollFocusTimer) {
                  clearTimeout(scrollFocusTimer);
                  scrollFocusTimer = null;
                  pendingScrollEventData = null;
            }
            if (document.visibilityState === 'visible' && pendingScrollEventData) {
                  scrollFocusTimer = setTimeout(function () {
                        if (pendingScrollEventData) {
                              sendGa4Event("vertical_scroll", {
                                    scroll_depth: pendingScrollEventData.scroll_depth,
                                    page_path: pendingScrollEventData.page_path,
                                    device_category: pendingScrollEventData.device_category
                              });
                              pendingScrollEventData = null;
                        }
                  }, 5000);
            }
      });

      // Envia profundidade máxima de scroll ao sair da página (somente GA4)
      function triggerScrollEvent() {
            if (!maxScrollEventSent) {
                  if (maxScrollDepth > 0) {
                        sendGa4Event("scroll_depth", {
                              max_scroll_depth: maxScrollDepth,
                              page_path: window.location.pathname,
                              device_category: getDeviceCategory()
                        });
                  }
                  maxScrollEventSent = true;
            }
      }

      document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') triggerScrollEvent();
      });
      window.addEventListener('pagehide', triggerScrollEvent);

      // --- Envio de Leads para Cloudflare (SOMENTE form_submit) ---

      /**
       * Envia a fila de leads pendentes para o Cloudflare Worker.
       * Chamado na submissão do formulário e no pagehide como fallback.
       */
      function flushQueue() {
            if (tjHub.sending) {
                  clearTimeout(tjHub.sending);
                  tjHub.sending = null;
            }

            if (tjHub.queue.length > 0) {
                  var eventsToSend = tjHub.queue.slice();
                  tjHub.queue = [];

                  var payload = JSON.stringify({ events: eventsToSend });
                  var url = TRACKING_ENDPOINT + "?site_id=" + tjHub.site_id;

                  if (navigator.sendBeacon) {
                        navigator.sendBeacon(url, payload);
                  } else {
                        fetch(url, { method: "POST", body: payload, keepalive: true });
                  }
            }
      }

      window.addEventListener('pagehide', flushQueue);

      /**
       * Enfileira um evento de lead para envio ao Cloudflare Worker.
       * IMPORTANTE: Usar APENAS para form_submit. Todos os outros eventos
       * devem usar sendGa4Event() diretamente.
       */
      tjHub.sendLead = function (data) {
            data.url = window.location.href;
            data.referrer = document.referrer;
            data.session_id = tjHub.session_id;
            data.site_id = tjHub.site_id;
            data.screen_size = window.innerWidth + "x" + window.innerHeight;
            data.device = navigator.userAgent;
            data.device_category = getDeviceCategory();
            data.timestamp = new Date().toISOString();

            tjHub.queue.push({ event: "form_submit", data: data });

            // Envio imediato para leads (não espera 5s)
            flushQueue();
      };

      // --- Eventos Automáticos ---

      // 1. Page View — somente GA4
      sendGa4Event("page_view", {
            page_path: window.location.pathname,
            page_title: document.title,
            device_category: getDeviceCategory()
      });

      // 2. Click Tracking — somente GA4
      document.addEventListener("click", function (event) {
            var clickX = event.pageX;
            var clickY = event.pageY;
            var clickXPercent = Math.round((event.clientX / window.innerWidth) * 100);
            var clickYPercent = Math.round((event.clientY / window.innerHeight) * 100);

            var closestInteractiveElement = event.target.closest("a, button");

            if (!closestInteractiveElement) {
                  sendGa4Event("heatmap_click", {
                        click_x: clickX,
                        click_y: clickY,
                        click_x_percent: clickXPercent,
                        click_y_percent: clickYPercent,
                        page_path: window.location.pathname,
                        element_id: event.target.id || "(not set)",
                        element_class: (typeof event.target.className === 'string' ? event.target.className : '') || "(not set)",
                        device_category: getDeviceCategory()
                  });
                  return;
            }

            var text = closestInteractiveElement.innerText ? closestInteractiveElement.innerText.substring(0, 50) : "";

            if (closestInteractiveElement.tagName.toLowerCase() === "a" && closestInteractiveElement.hostname !== window.location.hostname) {
                  sendGa4Event("click_outbound", {
                        click_x: clickX,
                        click_y: clickY,
                        link_url: closestInteractiveElement.href,
                        link_text: text,
                        page_path: window.location.pathname,
                        device_category: getDeviceCategory()
                  });
            } else {
                  sendGa4Event("click", {
                        click_x: clickX,
                        click_y: clickY,
                        element_id: closestInteractiveElement.id || "(not set)",
                        element_text: text,
                        page_path: window.location.pathname,
                        device_category: getDeviceCategory()
                  });
            }
      });

      // 3. Form Submit — envia para GA4 + Cloudflare D1 (leads)
      document.addEventListener("submit", function (event) {
            var form = event.target;
            if (!form || form.tagName.toLowerCase() !== "form") return;
            if (form.getAttribute("data-track") !== "true") return;

            // Trava anti-duplicidade
            if (form.getAttribute("data-tj-processing") === "true") return;
            form.setAttribute("data-tj-processing", "true");

            var formData = new FormData(form);
            var formFields = {};
            var leadInfo = { nome: null, email: null, tel: null };

            for (var pair of formData.entries()) {
                  var key = pair[0], value = pair[1];
                  if (typeof key === "string" && !key.toLowerCase().includes("senha")) {
                        formFields[key] = value;
                        var lowerKey = key.toLowerCase();
                        if (!leadInfo.nome && (lowerKey.includes("nome") || lowerKey.includes("name"))) {
                              leadInfo.nome = value;
                        } else if (!leadInfo.email && lowerKey.includes("mail")) {
                              leadInfo.email = value;
                        } else if (!leadInfo.tel && (lowerKey.includes("tel") || lowerKey.includes("cel") || lowerKey.includes("whats"))) {
                              leadInfo.tel = value;
                        }
                  }
            }

            var submitData = {
                  tag: form.getAttribute("data-tag") || "Form Site",
                  action: form.action || "",
                  method: form.method || "GET",
                  form_id: form.id || "",
                  form_class: form.className || "",
                  fields: formFields,
                  lead_info: leadInfo,
                  marketing: getMarketingData(),
                  page_path: window.location.pathname,
                  device_category: getDeviceCategory()
            };

            // Envia lead para Cloudflare D1
            tjHub.sendLead(submitData);

            // Envia evento para GA4
            sendGa4Event("form_submit", {
                  form_id: submitData.form_id || "(not set)",
                  form_destination: submitData.action,
                  page_path: window.location.pathname,
                  device_category: getDeviceCategory()
            });

            // Libera formulário após 3s para caso de AJAX
            setTimeout(function () { form.removeAttribute("data-tj-processing"); }, 3000);
      });

      // --- Finalização ---
      window.tjHub = tjHub;
})();
