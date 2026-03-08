export default {
  async fetch(request, env, ctx) {
    const db = env.DB;
    const url = new URL(request.url);

    // ============================================================
    // 🔒 0. CONFIGURAÇÃO & SEGURANÇA
    // ============================================================

    const ALLOWED_SITES = {
      TJPRI2025: ["printertech2.com.br"],
      TJ17EL6DIA: ["maqsolutionrefrigeracao.com.br"],
      TJTJS2025: [
        "tjstudio.com.br",
        "meudescontao.com.br",
        "dev-tjhub.tjstudio.com.br",
        "mediumslateblue-dove-197036.hostingersite.com",
      ],
      TJLIS396: [
        "lisaartes.com.br",
        "pink-woodpecker-366084.hostingersite.com",
      ],
      TJGIOVA192: ["sgvhidraulica.com.br"],
      TJPATRC497: ["gcambios.com.br"],
    };

    const API_KEYS = {
      TJPRI2025: "APIKEY123-TJPRI2025",
      TJ17EL6DIA: "APIKEY456-TJ17EL6DIA",
      TJTJS2025: "APIKEY789-TJTJS2025",
      TJLIS396: "APIKEY101112-TJLIS396",
      TJGIOVA192: "APIKEY10369-TJGIOVA192",
      TJPATRC497: "APIKEY98566-TJPATRC497",
    };

    // 🧹 Função para limpar o site_id de sujeiras de URL
    function cleanSiteId(id) {
      if (!id || typeof id !== 'string') return id;
      return id.split('&')[0].split('?')[0].trim();
    }

    function isOriginAllowed(siteId, request) {
      const allowedDomains = ALLOWED_SITES[siteId];
      if (!allowedDomains) return false;
      const origin = request.headers.get("Origin") || request.headers.get("Referer");
      if (!origin) return true;
      try {
        const hostname = new URL(origin).hostname;
        return allowedDomains.some(domain => hostname.includes(domain));
      } catch (e) { return false; }
    }

    function normalizeMarketing(m) {
      const def = { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, gclid: null, fbclid: null };
      if (!m) return def;
      if (Array.isArray(m) && m.length === 0) return def;
      if (typeof m === 'object') {
        return {
          utm_source: m.utm_source ?? null,
          utm_medium: m.utm_medium ?? null,
          utm_campaign: m.utm_campaign ?? null,
          utm_content: m.utm_content ?? null,
          utm_term: m.utm_term ?? null,
          gclid: m.gclid ?? null,
          fbclid: m.fbclid ?? null
        };
      }
      return def;
    }

    const siteId = cleanSiteId(url.searchParams.get("site_id"));

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (!siteId && !["/", "/sync-missed-leads", "/lead-update"].includes(url.pathname)) {
       if (url.pathname === "/get-tracking-data" && request.method === "POST" && !siteId) {
          return new Response(JSON.stringify({ error: "site_id invalido ou ausente" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
       }
    }

    // ============================================================
    // 🔹 1. INSERT (POST)
    // ============================================================
    if (request.method === "POST" && (
        url.pathname === "/" || 
        url.pathname === "/events" || 
        url.pathname === "/submit" || 
        url.pathname === "/get-tracking-data"
    )) {
      
      if (siteId && !isOriginAllowed(siteId, request)) {
          return new Response(JSON.stringify({ error: "Dominio nao autorizado na Whitelist" }), { 
              status: 403, 
              headers: { "Access-Control-Allow-Origin": "*" } 
          });
      }

      try {
        const data = await request.json();
        // Garante que temos uma lista de eventos e remove nulos
        const rawEvents = (data.events && Array.isArray(data.events)) ? data.events : [data];
        const eventsList = rawEvents.filter(e => e && e.event);

        let leadsToSend = [];
        const batch = [];
        const seenInBatch = new Set(); // 🛑 Anti-duplicidade no mesmo request

        // Prepared insert statement
        const insertStmt = db.prepare(
          `INSERT INTO global_events 
          (site_id, session_id, event_name, event_data, url, url_host, referrer, screen_size, device, ip, country, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const event of eventsList) {
          const currentSiteId = cleanSiteId(event.data?.site_id || siteId);
          if (!currentSiteId || !event.event) continue;

          // Chave única para evitar salvar o mesmo evento duas vezes no mesmo lote
          const eventFingerprint = `${event.event}-${event.data?.session_id}-${event.data?.timestamp}`;
          if (seenInBatch.has(eventFingerprint)) continue;
          seenInBatch.add(eventFingerprint);

          const ip = request.headers.get("CF-Connecting-IP") || "unknown";
          const user_agent = request.headers.get("User-Agent") || "unknown";
          const screen_size = event.data.screen_size || "unknown";
          const country = request.headers.get("CF-IPCountry") || "unknown";

          let eventTime = event.data.timestamp || new Date().toISOString();
          let eventDate = new Date(eventTime);
          eventDate.setHours(eventDate.getHours() - 3);
          let formattedTimestamp = eventDate.toISOString().replace("T", " ").substring(0, 19);

          let urlHost = "unknown";
          try { urlHost = new URL(event.data.url).hostname; } catch (e) {}

          if (event.event === "form_submit" || event.event === "purchase") {
              if (event.event === "form_submit") {
                // Inserção imediata para capturar o id gerado (id_cloud)
                await insertStmt.bind(
                  currentSiteId,
                  event.data.session_id || 'no-session',
                  event.event,
                  JSON.stringify(event.data),
                  event.data.url || null,
                  urlHost,
                  event.data.referrer || null,
                  screen_size,
                  user_agent,
                  ip,
                  country,
                  formattedTimestamp
                ).run();

                // Capturar id inserido - last_insert_rowid()
                const { results: last } = await db.prepare('SELECT last_insert_rowid() AS id').all();
                const insertedId = last && last[0] ? last[0].id : null;

                if (event.event === "form_submit") {
                  let marketingData = event.data.marketing || {};

                  if (Object.keys(marketingData).length === 0 && event.data.url) {
                      try {
                          const urlObj = new URL(event.data.url);
                          const p = urlObj.searchParams;
                          marketingData = {
                              utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'), utm_campaign: p.get('utm_campaign'),
                              utm_content: p.get('utm_content'), utm_term: p.get('utm_term'), gclid: p.get('gclid'), fbclid: p.get('fbclid')
                          };
                      } catch(e) {}
                  }

                  leadsToSend.push({
                    id_cloud: insertedId,
                    site_id: currentSiteId,
                    session_id: event.data.session_id,
                    tag: event.data.tag || event.data.fields?.tag || 'Form Cloudflare',
                    nome: event.data.fields?.nome || event.data.lead_info?.nome || null,
                    tel: event.data.fields?.tel || event.data.fields?.whatsapp || event.data.lead_info?.tel || null,
                    email: event.data.fields?.email || event.data.lead_info?.email || null,
                    pergunta: event.data.fields?.pergunta || JSON.stringify(event.data.fields) || null,
                    url: event.data.url || null,
                    referrer: event.data.referrer || null,
                    ip: ip,
                    user_agent: user_agent,
                    marketing: marketingData 
                  });
                }

              } else {
                // Para outros eventos (ex: purchase) podemos agrupar em batch
                batch.push(insertStmt.bind(
                  currentSiteId,
                  event.data.session_id || 'no-session',
                  event.event,
                  JSON.stringify(event.data),
                  event.data.url || null,
                  urlHost,
                  event.data.referrer || null,
                  screen_size,
                  user_agent,
                  ip,
                  country,
                  formattedTimestamp
                ));
              }
          }
        }

        // Executar batch para eventos não-form_submit (se houver)
        if (batch.length > 0) {
            await db.batch(batch);
        }

        // Disparar webhooks com id_cloud quando aplicável
        if (leadsToSend.length > 0) {
          const webhooks = [
            "https://api.tjstudio.com.br/api/webhook-cloud-leads", 
            "https://hub.tjstudio.com.br/api/webhook-central.php"
          ];
          const payload = JSON.stringify({ leads: leadsToSend });

          ctx.waitUntil(
             Promise.all(
                webhooks.map(async u => {
                  try {
                    const response = await fetch(u, {
                        method: "POST", 
                        headers: { "Content-Type": "application/json" }, 
                        body: payload 
                    });
                    console.log(`Webhook to ${u}: status ${response.status}`);
                    if (!response.ok) {
                      const text = await response.text();
                      console.log(`Webhook error for ${u}: ${text}`);
                    }
                  } catch (e) {
                    console.log(`Webhook fetch error for ${u}:`, e);
                  }
                })
             )
          );
        }

        return new Response(JSON.stringify({ success: true, saved: (leadsToSend.length + batch.length) }), { 
            status: 200,
            headers: { "Access-Control-Allow-Origin": "*" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: "Erro Worker", details: error.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    // ============================================================
    // 🔹 2. SELECT (GET)
    // ============================================================
    if (url.pathname === "/get-tracking-data" && request.method === "GET") {
      try {
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
        const currentSiteId = cleanSiteId(url.searchParams.get("site_id"));
        
        if (!apiKey || apiKey !== API_KEYS[currentSiteId]) {
          return new Response(JSON.stringify({ error: "Acesso não autorizado" }), { 
              status: 403, 
              headers: { "Access-Control-Allow-Origin": "*" } 
          });
        }

        const startDate = url.searchParams.get("start_date") || "2000-01-01 00:00:00";
        const endDate = url.searchParams.get("end_date") || "2100-01-01 23:59:59";
        const eventName = url.searchParams.get("event_name");
        
        let query = `SELECT event_name, event_data, ip, referrer, timestamp FROM global_events WHERE site_id = ? AND timestamp BETWEEN ? AND ?`;
        let params = [currentSiteId, startDate, endDate];
        if (eventName) {
          query += ` AND event_name = ?`;
          params.push(eventName);
        }
        query += ` ORDER BY timestamp DESC LIMIT 500`; 

        const { results } = await db.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Erro Leitura DB" }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    // ============================================================
    // 🔎 3. SYNC-MISSED-LEADS
    // ============================================================
    if (url.pathname === "/sync-missed-leads" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const syncSiteId = cleanSiteId(body.site_id || url.searchParams.get("site_id"));
        if (!syncSiteId) return new Response(JSON.stringify({ error: "site_id invalido" }), { status: 400 });

        const stmt = `SELECT id, session_id, event_data, url, referrer, ip, timestamp FROM global_events WHERE site_id = ? AND event_name = ? AND timestamp <= datetime('now', '-2 minutes') ORDER BY timestamp DESC LIMIT 1000`;
        const resp = await db.prepare(stmt).bind(syncSiteId, "form_submit").all();
        const forms = resp.results || [];
        const missed = [];

        for (const f of forms) {
          const sessionId = f.session_id || null;
          let alreadyDispatched = false;
          if (sessionId) {
            const r = await db.prepare(`SELECT 1 FROM global_events WHERE site_id = ? AND event_name = ? AND session_id = ? LIMIT 1`).bind(syncSiteId, "lead_dispatched", sessionId).all();
            if (r.results && r.results.length > 0) alreadyDispatched = true;
          }

          if (!alreadyDispatched) {
            let eventData = {};
            try { eventData = JSON.parse(f.event_data); } catch (e) {}
            const marketing = normalizeMarketing(eventData.marketing);
            const fields = eventData.fields || eventData.lead_info || {};
            missed.push({
              id_cloud: f.id,
              site_id: syncSiteId, session_id: f.session_id, tag: eventData.tag || fields.tag || "Form Cloudflare", 
              nome: fields.nome || null, tel: fields.tel || fields.whatsapp || null, email: fields.email || null, 
              pergunta: JSON.stringify(fields), url: f.url, referrer: f.referrer, ip: f.ip, marketing, timestamp: f.timestamp
            });
          }
        }
        return new Response(JSON.stringify({ input: { leads: missed } }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (err) { return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 }); }
    }

    // ============================================================
    // ✏️ 4. LEAD-UPDATE
    // ============================================================
    if (url.pathname === "/lead-update" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const updateSiteId = cleanSiteId(body.site_id || null);
        const updates = body.updates || body || {};

        if (!updateSiteId) return new Response(JSON.stringify({ error: "missing_site_id" }), { status: 400 });

        let query = `SELECT id, event_data, session_id FROM global_events WHERE site_id = ? AND event_name = 'form_submit'`;
        const binds = [updateSiteId];
        if (body.session_id) { query += ` AND session_id = ?`; binds.push(body.session_id); } 

        const { results } = await db.prepare(query).bind(...binds).all();
        let updated = 0;

        for (const row of results || []) {
          let eventData = JSON.parse(row.event_data);
          for (const k of Object.keys(updates)) { eventData[k] = updates[k]; }
          await db.prepare(`UPDATE global_events SET event_data = ? WHERE id = ?`).bind(JSON.stringify(eventData), row.id).run();
          updated++;
        }
        return new Response(JSON.stringify({ ok: true, updated }), { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
      } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
    }

    return new Response("TJ Hub Worker Active", { status: 200 });
  },
};
