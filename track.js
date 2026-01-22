// Versão: 1.0.0 - Última atualização: 21/01/2026
(function() {
    // Inicializa o dataLayer para o Google Tag Manager, se ele não existir.
    window.dataLayer = window.dataLayer || [];

    // Inicializa o objeto principal de rastreamento (tjHub) para evitar erros.
    var tjHub = window.tjHub || {};
    tjHub.queue = tjHub.queue || [];

    // Endpoint da API para onde os dados de rastreamento são enviados.
    const TRACKING_ENDPOINT = "https://tj-track-bd.tj-studio-ltda.workers.dev/get-tracking-data";

    // --- Integração com GA4 (Google Analytics 4) ---

    /**
     * Verifica se a biblioteca do GA4 (gtag.js) está disponível na página.
     * @returns {boolean} Verdadeiro se o GA4 estiver disponível, falso caso contrário.
     */
    function isGa4Available() {
        return typeof gtag !== 'undefined';
    }

    /**
     * Envia um evento para o GA4, se a biblioteca estiver disponível.
     * @param {string} eventName - O nome do evento a ser enviado (ex: 'page_view').
     * @param {object} eventParams - Os parâmetros adicionais para o evento.
     */
    function sendGa4Event(eventName, eventParams) {
        if (isGa4Available()) {
            try {
                gtag("event", eventName, {
                    ...eventParams,
                    send_to: "all", // Garante que o evento seja enviado para todas as propriedades do GA4.
                    non_interaction: eventName === "scroll" || eventName === "vertical_scroll" // Marca eventos de scroll como "não interação" para não afetar a taxa de rejeição.
                });
            } catch (error) {
                console.warn("GA4 tracking error:", error);
            }
        }
    }

    // --- Informações de Dispositivo e Tela ---

    /**
     * Determina a categoria do dispositivo com base na largura da tela.
     * @returns {string} 'mobile', 'tablet', or 'desktop'.
     */
    function getDeviceCategory() {
        const width = window.innerWidth;
        if (width <= 768) return "mobile";
        if (width <= 1024) return "tablet";
        return "desktop";
    }

    // --- IDs de Site e Sessão ---

    /**
     * Extrai o 'site_id' da URL do próprio script de rastreamento.
     * Usa um ID padrão ("TJTJS2025") se não encontrar.
     * @returns {string} O ID do site.
     */
    tjHub.site_id = (function() {
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.src.includes("site_id=")) {
                try {
                    // Tenta extrair o parâmetro 'site_id' da URL do script.
                    return new URL(script.src).searchParams.get("site_id");
                } catch (e) {
                    // Ignora erros de parsing da URL.
                }
            }
        }
        return "TJTJS2025"; // ID padrão de fallback.
    })();

    /**
     * Recupera o ID da sessão do localStorage ou gera um novo.
     * O ID da sessão agrupa todas as ações de uma mesma visita.
     */
    tjHub.session_id = localStorage.getItem("tj_session_id") || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("tj_session_id", tjHub.session_id);

    // --- Funções Auxiliares para Cookies ---

    const cookieHelper = {
        /**
         * Obtém o valor de um cookie pelo nome.
         * @param {string} name - O nome do cookie.
         * @returns {string|null} O valor do cookie ou nulo se não for encontrado.
         */
        get: (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return parts.pop().split(';').shift();
            }
            return null;
        },
        /**
         * Obtém o Client ID do Google Analytics (do cookie _ga).
         * @returns {string|null} O Client ID ou nulo.
         */
        getGaId: function() {
            const gaCookie = this.get('_ga');
            return gaCookie ? gaCookie.replace(/^GA1\.\d\./, '') : null;
        },
        /**
         * Obtém o Session ID do Google Analytics do cookie _ga_<container-id>.
         * @returns {string|null} O Session ID ou nulo.
         */
        getGaSession: function() {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                if (cookie.trim().startsWith('_ga_') && cookie.split('.').length > 2) {
                    return cookie.split('.')[2];
                }
            }
            return null;
        }
    };

    // --- Dados de Marketing (Atribuição) ---

    /**
     * Recupera todos os parâmetros de marketing armazenados no localStorage e cookies.
     * @returns {object} Um objeto contendo dados de UTM, GCLID, FBCLID e GA.
     */
    function getMarketingData() {
        return {
            utm_source: localStorage.getItem("tj_utm_source"),
            utm_medium: localStorage.getItem("tj_utm_medium"),
            utm_campaign: localStorage.getItem("tj_utm_campaign"),
            utm_content: localStorage.getItem("tj_utm_content"),
            utm_term: localStorage.getItem("tj_utm_term"),
            gclid: localStorage.getItem("tj_gclid"), // Google Click ID
            fbclid: localStorage.getItem("tj_fbclid"), // Facebook Click ID
            ga_client_id: cookieHelper.getGaId(),
            ga_session_id: cookieHelper.getGaSession(),
            fbp: cookieHelper.get('_fbp'), // Facebook Pixel ID
            fbc: cookieHelper.get('_fbc') // Facebook Click ID
        };
    }

    /**
     * Captura parâmetros de marketing da URL (UTMs, GCLID, etc.) e os armazena no localStorage.
     * Isso é auto-executado na inicialização do script.
     */
    (function captureMarketingParams() {
        const params = new URLSearchParams(window.location.search);
        const marketingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
        marketingKeys.forEach(key => {
            if (params.has(key)) {
                localStorage.setItem("tj_" + key, params.get(key));
            }
        });
    })();

    // --- Rastreamento de Scroll (Rolagem da Página) ---
// Abordagem moderna para rastrear a profundidade máxima de rolagem com eficiência.

let maxScrollDepth = 0;
let maxScrollEventSent = false; // Flag para garantir que o evento seja enviado apenas uma vez por página.
let lastSentScrollDepth = 0; // Para evitar envio duplicado

// 1. Durante a navegação, apenas observa e atualiza a profundidade máxima atingida.
window.addEventListener("scroll", function() {
    const totalHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    ) - window.innerHeight;

    const currentDepth = totalHeight > 0 ? Math.round((window.scrollY / totalHeight) * 100) : 0;

    if (currentDepth > maxScrollDepth) {
        maxScrollDepth = currentDepth;
        // Dispara evento vertical_scroll sempre que atingir uma nova profundidade máxima
        if (currentDepth > lastSentScrollDepth) {
            lastSentScrollDepth = currentDepth;
            const eventData = {
                scroll_y: window.scrollY,
                scroll_depth: currentDepth,
                max_scroll_depth: maxScrollDepth,
                screen_size: `${window.innerWidth}x${window.innerHeight}`,
                session_id: tjHub.session_id,
                page_path: window.location.pathname,
                device_category: getDeviceCategory()
            };
            console.log('[TJHub] vertical_scroll event', eventData);
            tjHub.track("vertical_scroll", eventData);
            sendGa4Event("vertical_scroll", {
                scroll_depth: currentDepth,
                page_path: window.location.pathname,
                device_category: getDeviceCategory()
            });
        }
    }
}, { passive: true });

/**
 * Função unificada para disparar o evento de scroll.
 * Garante que o evento seja enviado apenas uma vez.
 */
function triggerScrollEvent() {
    if (!maxScrollEventSent) {
        if (maxScrollDepth > 0) {
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
        }
        maxScrollEventSent = true;
    }
}

// 2. Adiciona listeners para eventos de saída da página.
// 'visibilitychange' cobre trocas de aba e minimização.
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        triggerScrollEvent();
    }
});

// 'pagehide' é um gatilho mais robusto para quando o usuário navega para outra página ou fecha a aba.
window.addEventListener('pagehide', triggerScrollEvent);



    // --- Função Principal de Rastreamento ---

    /**
     * Força o envio de todos os eventos na fila.
     * Ideal para ser usado antes do descarregamento da página.
     */
    function flushQueue() {
        // Cancela qualquer envio agendado para evitar duplicidade.
        if (tjHub.sending) {
            clearTimeout(tjHub.sending);
            tjHub.sending = null;
        }

        if (tjHub.queue.length > 0) {
            let eventsToSend = tjHub.queue.slice();
            tjHub.queue = [];

            const payload = JSON.stringify({ events: eventsToSend });
            const url = `${TRACKING_ENDPOINT}?site_id=${tjHub.site_id}`;

            // sendBeacon é a API ideal para enviar dados no momento da saída da página.
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, payload);
            } else {
                // Fallback síncrono para navegadores mais antigos.
                fetch(url, { method: "POST", body: payload, keepalive: false });
            }
        }
    }
    
    // Adiciona um listener global para garantir que a fila seja enviada antes da página fechar.
    window.addEventListener('pagehide', flushQueue);

    /**
     * Coleta e enfileira um evento para ser enviado ao servidor.
     * @param {string} eventName - Nome do evento.
     * @param {object} data - Dados específicos do evento.
     */
    tjHub.track = function(eventName, data = {}) {
        // Enriquece os dados do evento com informações comuns a todos os eventos.
        data.url = window.location.href;
        data.referrer = document.referrer;
        data.session_id = tjHub.session_id;
        data.site_id = tjHub.site_id;
        data.screen_size = `${window.innerWidth}x${window.innerHeight}`;
        data.device = navigator.userAgent;
        data.device_category = getDeviceCategory();
        data.timestamp = new Date().toISOString();

        // Adiciona o evento à fila.
        tjHub.queue.push({
            event: eventName,
            data: data
        });

        // Se um envio já não estiver agendado, agenda um novo.
        if (!tjHub.sending) {
            tjHub.sending = setTimeout(flushQueue, 5000); // Usa a função flushQueue para enviar os dados.
        }
    };

    // --- Rastreamento Automático de Eventos ---

    // 1. Page View (Visualização de Página)
    // Este é o primeiro evento enviado, registrando que uma página foi visitada.
    tjHub.track("page_view");
    sendGa4Event("page_view", {
        page_path: window.location.pathname,
        page_title: document.title,
        device_category: getDeviceCategory()
    });

    // 2. Click Tracking (Rastreamento de Cliques)
    document.addEventListener("click", function(event) {
        const clickX = event.pageX;
        const clickY = event.pageY;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const clickXPercent = Math.round((event.clientX / windowWidth) * 100);
        const clickYPercent = Math.round((event.clientY / windowHeight) * 100);

        // Encontra o elemento interativo mais próximo (link ou botão) do alvo do clique.
        const closestInteractiveElement = event.target.closest("a, button");

        // Se não for um clique em elemento interativo, registra como 'heatmap_click'.
        if (!closestInteractiveElement) {
            const heatmapData = {
                click_x: clickX,
                click_y: clickY,
                click_x_percent: clickXPercent,
                click_y_percent: clickYPercent,
                page_path: window.location.pathname,
                target: event.target.tagName.toLowerCase(),
                class: event.target.className || "",
                id: event.target.id || "",
                device_category: getDeviceCategory()
            };
            tjHub.track("heatmap_click", heatmapData);
            sendGa4Event("heatmap_click", {
                click_x: clickX,
                click_y: clickY,
                page_path: window.location.pathname,
                element_id: event.target.id || "(not set)",
                element_class: event.target.className || "(not set)",
                device_category: getDeviceCategory()
            });
            return;
        }

        // Se for um clique em um elemento interativo, coleta mais detalhes.
        let clickData = {
            target: closestInteractiveElement.tagName.toLowerCase(),
            text: closestInteractiveElement.innerText ? closestInteractiveElement.innerText.substring(0, 50) : "",
            class: closestInteractiveElement.className || "",
            id: closestInteractiveElement.id || "",
            href: closestInteractiveElement.href || "",
            click_x: clickX,
            click_y: clickY,
            click_x_percent: clickXPercent,
            click_y_percent: clickYPercent,
            page_path: window.location.pathname,
            device_category: getDeviceCategory()
        };

        // Diferencia entre cliques internos e externos (outbound).
        if (closestInteractiveElement.tagName.toLowerCase() === "a" && closestInteractiveElement.hostname !== window.location.hostname) {
            clickData.external = true;
            tjHub.track("click_outbound", clickData);
            
            // Usa sendBeacon para garantir que o evento seja enviado antes da página ser descarregada.
            const url = `${TRACKING_ENDPOINT}?site_id=${tjHub.site_id}`;
            const payload = JSON.stringify({ events: [{ event: "click_outbound", data: clickData }] });
            navigator.sendBeacon(url, payload);

            sendGa4Event("click_outbound", {
                click_x: clickX,
                click_y: clickY,
                link_url: closestInteractiveElement.href,
                link_text: clickData.text,
                page_path: window.location.pathname,
                device_category: getDeviceCategory()
            });
        } else {
            // Se for um clique interno.
            tjHub.track("click", clickData);
            sendGa4Event("click", {
                click_x: clickX,
                click_y: clickY,
                element_id: clickData.id || "(not set)",
                element_text: clickData.text,
                page_path: window.location.pathname,
                device_category: getDeviceCategory()
            });
        }
    });

    // 3. Form Submission (Envio de Formulário)
    document.addEventListener("submit", function(event) {
        const form = event.target;
        // Garante que o alvo do evento é um formulário e que ele tem o atributo 'data-track' como 'true'.
        if (!form || form.tagName.toLowerCase() !== "form") return;
        if (form.getAttribute("data-track") !== "true") return;

        let formData = new FormData(form);
        let formFields = {};
        let leadInfo = { nome: null, email: null, tel: null };

        for (let [key, value] of formData.entries()) {
            // Exclui campos sensíveis que contenham "senha".
            if (typeof key === "string" && !key.toLowerCase().includes("senha")) {
                formFields[key] = value;

                // Heurística para identificar informações de lead (nome, email, telefone).
                let lowerKey = key.toLowerCase();
                if (!leadInfo.nome && (lowerKey.includes("nome") || lowerKey.includes("name"))) {
                    leadInfo.nome = value;
                } else if (!leadInfo.email && lowerKey.includes("mail")) {
                    leadInfo.email = value;
                } else if (!leadInfo.tel && (lowerKey.includes("tel") || lowerKey.includes("cel") || lowerKey.includes("whats"))) {
                    leadInfo.tel = value;
                }
            }
        }

        const submitData = {
            tag: form.getAttribute("data-tag") || "Form Site",
            action: form.action || "",
            method: form.method || "GET",
            form_id: form.id || "",
            form_class: form.className || "",
            fields: formFields,
            lead_info: leadInfo,
            marketing: getMarketingData(), // Anexa todos os dados de marketing capturados.
            page_path: window.location.pathname,
            device_category: getDeviceCategory()
        };

        tjHub.track("form_submit", submitData);
        sendGa4Event("form_submit", {
            form_id: submitData.form_id || "(not set)",
            form_destination: submitData.action,
            page_path: window.location.pathname,
            device_category: getDeviceCategory()
        });
    });

    // --- Finalização ---

    // Expõe o objeto tjHub globalmente na janela do navegador.
    window.tjHub = tjHub;
    console.log("✅ TJ Track Enhanced with GA4 Heatmap initialized", {
        site_id: tjHub.site_id,
        session_id: tjHub.session_id,
        ga4_available: isGa4Available()
    });

})();
