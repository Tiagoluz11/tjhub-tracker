(function () {
    let tjHub = window.tjHub || {};
    tjHub.dataLayer = tjHub.dataLayer || [];

    tjHub.track = function (event, data = {}) {
        data.url = window.location.href;
        data.referrer = document.referrer;
        data.screen_size = `${window.screen.width}x${window.screen.height}`;
        data.device = navigator.userAgent;
        data.timestamp = new Date().toISOString();
        data.site_id = tjHub.site_id || 'UNKNOWN_SITE';

        tjHub.dataLayer.push({ event, data });

        if (!tjHub.sending) {
            tjHub.sending = setTimeout(() => {
                let eventsToSend = tjHub.dataLayer.slice();
                tjHub.dataLayer = [];
                navigator.sendBeacon('https://api.tjhub.com.br/track', JSON.stringify({ events: eventsToSend }));
                tjHub.sending = null;
            }, 5000);
        }
    };

    tjHub.track('page_view');

    window.tjHub = tjHub;
})();
