<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clawbot — Kudicall Outreach Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:       #0d0f14;
            --surface:  #161a24;
            --card:     #1e2330;
            --border:   #2a3045;
            --accent:   #7c3aed;
            --accent2:  #4f46e5;
            --green:    #10b981;
            --red:      #ef4444;
            --amber:    #f59e0b;
            --blue:     #3b82f6;
            --text:     #e2e8f0;
            --muted:    #64748b;
            --radius:   12px;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
        }

        /* ── HEADER ─────────────────────────────── */
        header {
            background: linear-gradient(135deg, #1e2330 0%, #1a1e2e 100%);
            border-bottom: 1px solid var(--border);
            padding: 18px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
        }
        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .logo-icon {
            width: 38px; height: 38px;
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
        }
        .logo h1 { font-size: 20px; font-weight: 700; }
        .logo span { color: var(--accent); }

        .bot-badge {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px; font-weight: 500;
            background: var(--card);
            border: 1px solid var(--border);
            transition: all 0.3s;
        }
        .dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--muted);
            transition: all 0.3s;
        }
        .dot.online  { background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
        .dot.offline { background: var(--red); }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.5; }
        }

        /* ── MAIN LAYOUT ────────────────────────── */
        main { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }

        /* ── CARDS ──────────────────────────────── */
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
        }
        .card-title {
            font-size: 13px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.05em; color: var(--muted); margin-bottom: 16px;
        }

        /* ── STAT CARDS ─────────────────────────── */
        .stat-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: border-color 0.3s;
        }
        .stat-card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0;
            height: 3px;
        }
        .stat-card.purple::before { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
        .stat-card.green::before  { background: var(--green); }
        .stat-card.red::before    { background: var(--red); }
        .stat-card.amber::before  { background: var(--amber); }

        .stat-label { font-size: 12px; color: var(--muted); font-weight: 500; margin-bottom: 8px; }
        .stat-value { font-size: 32px; font-weight: 800; }
        .stat-card.purple .stat-value { color: #a78bfa; }
        .stat-card.green  .stat-value { color: var(--green); }
        .stat-card.red    .stat-value { color: var(--red); }
        .stat-card.amber  .stat-value { color: var(--amber); }
        .stat-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

        /* ── BUTTONS ────────────────────────────── */
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 14px; font-weight: 600;
            font-family: 'Inter', sans-serif;
            transition: all 0.2s;
            display: inline-flex; align-items: center; gap: 8px;
        }
        .btn:active { transform: scale(0.97); }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            color: white;
        }
        .btn-primary:hover { opacity: 0.9; box-shadow: 0 4px 20px rgba(124,58,237,0.4); }
        .btn-danger  { background: var(--red); color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn-ghost {
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--border);
        }
        .btn-ghost:hover { background: var(--card); }
        .btn-success { background: var(--green); color: white; }
        .btn-success:hover { background: #059669; }
        .btn-amber { background: var(--amber); color: #1a1a1a; }
        .btn-sm { padding: 7px 14px; font-size: 13px; }

        .btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── CONTROL BAR ────────────────────────── */
        .control-bar {
            display: flex; align-items: center; gap: 12px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px 24px;
            margin-bottom: 24px;
        }
        .control-bar h2 { font-size: 16px; font-weight: 700; flex: 1; }

        /* ── CAMPAIGN STATUS BADGE ──────────────── */
        .campaign-pill {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px; font-weight: 600;
        }
        .campaign-pill.active  { background: rgba(16,185,129,0.15); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }
        .campaign-pill.paused  { background: rgba(245,158,11,0.15); color: var(--amber); border: 1px solid rgba(245,158,11,0.3); }

        /* ── INPUTS ─────────────────────────────── */
        input[type="text"], input[type="url"], input[type="number"], textarea, select {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            padding: 10px 14px;
            width: 100%;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus, textarea:focus, select:focus { border-color: var(--accent); }
        textarea { resize: vertical; min-height: 100px; }
        label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; font-weight: 500; }
        .form-group { margin-bottom: 16px; }

        /* ── LOGS TABLE ─────────────────────────── */
        .log-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .log-table th {
            text-align: left; padding: 10px 14px;
            color: var(--muted); font-size: 11px; text-transform: uppercase;
            letter-spacing: 0.05em; border-bottom: 1px solid var(--border);
        }
        .log-table td { padding: 11px 14px; border-bottom: 1px solid rgba(42,48,69,0.5); }
        .log-table tr:hover td { background: rgba(255,255,255,0.02); }
        .log-table tr:last-child td { border-bottom: none; }

        .badge {
            display: inline-block;
            padding: 2px 10px; border-radius: 20px;
            font-size: 11px; font-weight: 600;
        }
        .badge-sent     { background: rgba(16,185,129,0.15); color: var(--green); }
        .badge-failed   { background: rgba(239,68,68,0.15);  color: var(--red); }
        .badge-replied  { background: rgba(59,130,246,0.15); color: var(--blue); }
        .badge-pending  { background: rgba(245,158,11,0.15); color: var(--amber); }

        /* ── PROGRESS BAR ───────────────────────── */
        .progress-bar {
            background: var(--surface);
            border-radius: 99px; height: 6px; overflow: hidden; margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--accent), var(--accent2));
            border-radius: 99px;
            transition: width 1s ease;
        }

        /* ── TOAST ──────────────────────────────── */
        #toast {
            position: fixed; bottom: 24px; right: 24px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 14px 20px;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            transform: translateY(80px); opacity: 0;
            transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
            z-index: 9999;
            max-width: 320px;
        }
        #toast.show { transform: translateY(0); opacity: 1; }
        #toast.success { border-left: 3px solid var(--green); }
        #toast.error   { border-left: 3px solid var(--red); }
        #toast.info    { border-left: 3px solid var(--accent); }

        /* ── TEST PANEL ─────────────────────────── */
        .test-row { display: flex; gap: 10px; }
        .test-row input { flex: 1; }

        /* ── REFRESH INDICATOR ──────────────────── */
        .refresh-label { font-size: 12px; color: var(--muted); }

        /* ── RATE INFO ──────────────────────────── */
        .rate-info {
            display: flex; align-items: center; gap: 8px;
            font-size: 13px; color: var(--muted);
        }

        .separator { height: 1px; background: var(--border); margin: 24px 0; }

        @media (max-width: 900px) {
            .grid-4 { grid-template-columns: repeat(2, 1fr); }
            .grid-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 500px) {
            .grid-4 { grid-template-columns: 1fr 1fr; }
            .control-bar { flex-wrap: wrap; }
        }
    </style>
</head>
<body>

<header>
    <div class="logo">
        <div class="logo-icon">🤖</div>
        <h1>Claw<span>bot</span></h1>
    </div>
    <div style="display:flex; align-items:center; gap:14px;">
        <span class="refresh-label">Auto-refresh: <span id="countdown">10</span>s</span>
        <div class="bot-badge">
            <div class="dot" id="botDot"></div>
            <span id="botStatus">Checking...</span>
        </div>
    </div>
</header>

<main>

    <!-- ── CONTROL BAR ── -->
    <div class="control-bar">
        <h2>Kudicall Outreach Campaign</h2>
        <span class="campaign-pill paused" id="campaignPill">⏸ Paused</span>
        <button class="btn btn-success" id="btnStart" onclick="startCampaign()">▶ Start Campaign</button>
        <button class="btn btn-danger"  id="btnStop"  onclick="stopCampaign()" style="display:none;">⏸ Pause</button>
        <button class="btn btn-ghost btn-sm" onclick="refreshAll()">↻ Refresh</button>
    </div>

    <!-- ── STAT CARDS ── -->
    <div class="grid-4">
        <div class="stat-card purple">
            <div class="stat-label">Total Vendors</div>
            <div class="stat-value" id="statTotal">—</div>
            <div class="stat-sub">in database</div>
        </div>
        <div class="stat-card amber">
            <div class="stat-label">Pending Outreach</div>
            <div class="stat-value" id="statPending">—</div>
            <div class="stat-sub">waiting to be contacted</div>
        </div>
        <div class="stat-card green">
            <div class="stat-label">Contacted</div>
            <div class="stat-value" id="statContacted">—</div>
            <div class="stat-sub">WhatsApp sent</div>
        </div>
        <div class="stat-card red">
            <div class="stat-label">Failed</div>
            <div class="stat-value" id="statFailed">—</div>
            <div class="stat-sub">could not reach</div>
        </div>
    </div>

    <!-- ── BOT RATE + TODAY STATS ── -->
    <div class="grid-2" style="margin-bottom:24px;">
        <div class="card">
            <div class="card-title">Today's Activity</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span id="sentToday" style="font-size:24px; font-weight:700; color:var(--green);">—</span>
                <span style="color:var(--muted); font-size:14px; align-self:flex-end;">messages sent today</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="dailyProgress" style="width:0%"></div>
            </div>
        </div>
        <div class="card">
            <div class="card-title">Bot Rate Limit</div>
            <div class="rate-info">
                <span id="sentHour" style="font-size:24px; font-weight:700; color:var(--accent);">—</span>
                <span style="color:var(--muted); font-size:14px;">/ <span id="rateLimit">20</span> this hour</span>
            </div>
            <div class="progress-bar" style="margin-top:12px;">
                <div class="progress-fill" id="hourProgress" style="width:0%"></div>
            </div>
            <div style="margin-top:8px; font-size:12px; color:var(--muted);" id="queueInfo">Queue: — pending</div>
        </div>
    </div>

    <!-- ── SETTINGS + TEST PANEL ── -->
    <div class="grid-2" style="margin-bottom:24px;">

        <!-- Settings -->
        <div class="card">
            <div class="card-title">Campaign Settings</div>
            <div class="form-group">
                <label>Kudicall App Link</label>
                <input type="url" id="cfgLink" placeholder="https://kudicall.com">
            </div>
            <div class="form-group">
                <label>Messages Per Hour (max 50, safe: 20)</label>
                <input type="number" id="cfgRate" min="1" max="50" value="20">
            </div>
            <div class="form-group">
                <label>Search URLs to Scrape (one per line)</label>
                <textarea id="cfgUrls" placeholder="https://jiji.ng/phones&#10;https://jiji.ng/electronics"></textarea>
            </div>
            <div class="form-group">
                <label>Custom Message Template (leave blank for default)</label>
                <textarea id="cfgTemplate" placeholder="Optional — uses built-in Kudicall pitch if empty"></textarea>
            </div>
            <button class="btn btn-primary" onclick="saveConfigure()">💾 Save Settings</button>
        </div>

        <!-- Test Panel -->
        <div class="card">
            <div class="card-title">Test Send</div>
            <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">
                Send a test WhatsApp message to any number to verify the bot is working before launching the campaign.
            </p>
            <div class="form-group">
                <label>Phone Number (Nigerian format e.g. 08012345678)</label>
                <input type="text" id="testPhone" placeholder="08012345678">
            </div>
            <div class="form-group">
                <label>Vendor Name (for personalisation)</label>
                <input type="text" id="testName" placeholder="John">
            </div>
            <div class="form-group">
                <label>Product (for personalisation)</label>
                <input type="text" id="testProduct" placeholder="iPhone 13">
            </div>
            <button class="btn btn-primary" onclick="testSend()" id="btnTest">📤 Send Test Message</button>

            <div class="separator"></div>

            <div class="card-title">Actions</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" onclick="dispatchPending()">⚡ Dispatch All Pending</button>
            </div>
            <p style="font-size:12px; color:var(--muted); margin-top:10px;">
                "Dispatch All Pending" queues every vendor with status=pending for outreach immediately.
            </p>
        </div>
    </div>

    <!-- ── RECENT LOGS ── -->
    <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:0;">Recent Outreach Logs</div>
            <span id="logsCount" style="font-size:12px; color:var(--muted);">Loading...</span>
        </div>
        <div style="overflow-x:auto;">
            <table class="log-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Vendor</th>
                        <th>Phone</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Sent At</th>
                    </tr>
                </thead>
                <tbody id="logsBody">
                    <tr><td colspan="6" style="text-align:center; color:var(--muted); padding:32px;">Loading logs...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

</main>

<!-- Toast -->
<div id="toast"></div>

<script>
    const API = '/api/clawbot';
    let refreshTimer = null;
    let countdown = 10;

    // ── TOAST ─────────────────────────────────────
    function toast(msg, type = 'info') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = `show ${type}`;
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
    }

    // ── FETCH HELPERS ─────────────────────────────
    async function api(path, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(API + path, opts);
        return res.json();
    }

    // ── STATUS ────────────────────────────────────
    async function refreshStatus() {
        try {
            const data = await api('/status');

            // Bot badge
            const botOnline = data.bot?.status === 'ready';
            document.getElementById('botDot').className   = 'dot ' + (botOnline ? 'online' : 'offline');
            document.getElementById('botStatus').textContent = botOnline ? '🤖 Bot Online' : '🔴 Bot Offline';

            // Stats
            document.getElementById('statTotal').textContent     = data.total_vendors ?? '—';
            document.getElementById('statPending').textContent   = data.pending ?? '—';
            document.getElementById('statContacted').textContent = data.contacted ?? '—';
            document.getElementById('statFailed').textContent    = data.failed ?? '—';
            document.getElementById('sentToday').textContent     = data.sent_today ?? '—';

            // Progress
            const total = data.total_vendors || 1;
            document.getElementById('dailyProgress').style.width = Math.min(100, (data.sent_today / total) * 100) + '%';

            // Rate
            const sent  = data.bot?.sentThisHour ?? 0;
            const limit = data.bot?.rateLimit     ?? 20;
            document.getElementById('sentHour').textContent    = sent;
            document.getElementById('rateLimit').textContent   = limit;
            document.getElementById('hourProgress').style.width = Math.min(100, (sent / limit) * 100) + '%';
            document.getElementById('queueInfo').textContent   = `Queue: ${data.bot?.queueLength ?? 0} pending`;

            // Campaign pill
            const active = data.campaign_active;
            const pill   = document.getElementById('campaignPill');
            pill.textContent  = active ? '🟢 Running' : '⏸ Paused';
            pill.className    = 'campaign-pill ' + (active ? 'active' : 'paused');
            document.getElementById('btnStart').style.display = active ? 'none'   : 'inline-flex';
            document.getElementById('btnStop').style.display  = active ? 'inline-flex' : 'none';

            // Rate config
            document.getElementById('cfgRate').value = data.messages_per_hour ?? 20;

        } catch (e) {
            document.getElementById('botStatus').textContent = '⚠ Error';
        }
    }

    // ── LOGS ──────────────────────────────────────
    async function refreshLogs() {
        try {
            const logs = await api('/logs?limit=25');
            const tbody = document.getElementById('logsBody');
            document.getElementById('logsCount').textContent = `${logs.length} recent entries`;

            if (!logs.length) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;">No outreach logs yet. Start the campaign!</td></tr>`;
                return;
            }

            tbody.innerHTML = logs.map(l => `
                <tr>
                    <td style="color:var(--muted)">${l.id}</td>
                    <td>${l.vendor?.name ?? '—'}</td>
                    <td style="font-family:monospace;font-size:12px">${l.phone ?? '—'}</td>
                    <td><span class="badge badge-sent">${l.channel}</span></td>
                    <td><span class="badge badge-${l.status}">${l.status}</span></td>
                    <td style="color:var(--muted);font-size:12px">${l.sent_at ? new Date(l.sent_at).toLocaleString() : '—'}</td>
                </tr>
            `).join('');
        } catch(e) {}
    }

    // ── LOAD CONFIG ───────────────────────────────
    async function loadConfig() {
        try {
            const data = await api('/status');
            // Config values are returned in status response via campaign
        } catch(e) {}
    }

    // ── ACTIONS ───────────────────────────────────
    async function startCampaign() {
        document.getElementById('btnStart').disabled = true;
        toast('Starting campaign...', 'info');
        try {
            const res = await api('/start', 'POST');
            toast(`✅ ${res.message} — ${res.vendors_queued} vendors queued`, 'success');
        } catch(e) { toast('Failed to start', 'error'); }
        document.getElementById('btnStart').disabled = false;
        refreshAll();
    }

    async function stopCampaign() {
        document.getElementById('btnStop').disabled = true;
        const res = await api('/stop', 'POST');
        toast('⏸ ' + res.message, 'info');
        document.getElementById('btnStop').disabled = false;
        refreshAll();
    }

    async function saveConfigure() {
        const urls = document.getElementById('cfgUrls').value
            .split('\n').map(u => u.trim()).filter(Boolean);

        const body = {
            messages_per_hour: parseInt(document.getElementById('cfgRate').value) || 20,
            kudicall_link:     document.getElementById('cfgLink').value || undefined,
            search_urls:       urls.length ? urls : undefined,
            message_template:  document.getElementById('cfgTemplate').value || undefined,
            platforms:         ['jiji'],
        };

        try {
            const res = await api('/configure', 'POST', body);
            toast('✅ Settings saved!', 'success');
        } catch(e) { toast('Failed to save settings', 'error'); }
    }

    async function testSend() {
        const phone   = document.getElementById('testPhone').value.trim();
        const name    = document.getElementById('testName').value.trim();
        const product = document.getElementById('testProduct').value.trim();

        if (!phone) { toast('Enter a phone number first!', 'error'); return; }

        const btn = document.getElementById('btnTest');
        btn.disabled = true;
        btn.textContent = '⏳ Sending...';
        toast('Sending test message...', 'info');

        try {
            const res = await api('/test-send', 'POST', { phone, name, product });
            if (res.success) {
                toast('✅ Test message sent! Check your WhatsApp.', 'success');
            } else {
                toast('❌ ' + (res.error || 'Failed'), 'error');
            }
        } catch(e) { toast('Error: ' + e.message, 'error'); }

        btn.disabled = false;
        btn.textContent = '📤 Send Test Message';
    }

    async function dispatchPending() {
        toast('Dispatching pending vendors...', 'info');
        try {
            const res = await api('/dispatch-pending', 'POST');
            toast('✅ ' + res.message, 'success');
        } catch(e) { toast('Failed', 'error'); }
        refreshAll();
    }

    // ── AUTO-REFRESH ──────────────────────────────
    function refreshAll() {
        countdown = 10;
        refreshStatus();
        refreshLogs();
    }

    function startCountdown() {
        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown;
            if (countdown <= 0) {
                refreshAll();
                countdown = 10;
            }
        }, 1000);
    }

    // ── INIT ──────────────────────────────────────
    refreshAll();
    startCountdown();
</script>
</body>
</html>
