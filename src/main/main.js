const { app, BrowserWindow, shell, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { GsiServer } = require('./gsi-server');
const { OscSender } = require('./osc-out');
const { SessionServer } = require('./session-server');
const { Discovery, SessionClient } = require('./session-client');
const { findeCs2CfgOrdner, findeRlConfigOrdner } = require('./cs2-pfad');
const { RlClient } = require('./rl-client');
const { Regie } = require('../core/regie');
const { RegieSim } = require('../core/regie-sim');
const { CsQuelle } = require('../core/cs-quelle');
const { RlQuelle } = require('../core/rl-quelle');
const { rlIni, leseRlIni, RL_INI_DATEI } = require('../core/rl-ini');
const { migrateKonfig } = require('../core/defaults');
const { gsiCfg, CFG_DATEI } = require('../core/cfg');
const { testNachricht, zeigeNachricht } = require('../core/signal');
const { overlayStatus } = require('../core/overlay-status');
const { kartenListe, lokaleIp } = require('../core/netzwerk');
const { SimRunner } = require('../core/sim-runner');
const { SimMatch } = require('../core/gsi-sim');
const { RlSimMatch } = require('../core/rl-sim');
const os = require('os');

const karten = () => kartenListe(os.networkInterfaces());

const root = app.getAppPath();
const KONFIG_DATEI = () => path.join(app.getPath('userData'), 'advanced-lan.json');
let mainWin = null;

/* ── Einstellungen ────────────────────────────────────────────────────── */
let cfg = null;
function ladeKonfig() {
  try { cfg = migrateKonfig(JSON.parse(fs.readFileSync(KONFIG_DATEI(), 'utf8'))); }
  catch { cfg = migrateKonfig(null); }
}
let speicherTimer = null;
function speichereKonfig() {
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(KONFIG_DATEI()), { recursive: true }); fs.writeFileSync(KONFIG_DATEI(), JSON.stringify(cfg, null, 1)); }
    catch (e) { meldung(`Einstellungen nicht gespeichert: ${e.message}`, 'err'); }
  }, 300);
}

/* ── An die Oberfläche melden ─────────────────────────────────────────── */
const an = (kanal, daten) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(kanal, daten); };
const meldung = (text, art = 'ok') => an('meldung', { text, art });
let statusTimer = null;
const statusMelden = () => {
  if (statusTimer) return;
  statusTimer = setTimeout(() => { statusTimer = null; an('status', gesamtStatus()); overlayMelden(); }, 120);
};

/* ── Modus Regie: Session, aktives Spiel, Cues → OSC ──────────────────── */
const osc = new OscSender();
const regie = new Regie({
  getConfig: () => cfg.regie,
  send: (s) => oscSenden(s),
  emit: (typ, d) => {
    if (typ === 'event') an('regie-event', d);
    if (typ === 'fehler') meldung(`OSC fehlgeschlagen: ${d}`, 'err');
    statusMelden();
  },
});
// Absenderkarte: die des Ziels, sonst die für „Senden“, sonst automatisch
function oscSenden(s) {
  const l = lokaleIp(karten(), s.ziel.netz || cfg.regie.netz?.senden);
  return l.fehler ? Promise.reject(new Error(l.fehler)) : osc.send({ ...s, lokal: l.ip });
}
const session = new SessionServer({ regie, getConfig: () => cfg.regie, onChange: statusMelden, lokal: () => lokaleIp(karten(), cfg.regie.netz?.empfang) });
const regieSim = new RegieSim({ regie, onChange: statusMelden });

// Auf dem Regie-PC darf kein Spiel laufen (Windows: Prozessliste prüfen)
const SPIEL_PROZESSE = { 'cs2.exe': 'CS2', 'valorant-win64-shipping.exe': 'Valorant', 'rocketleague.exe': 'Rocket League' };
let spielAufRegie = '', spielCheck = null;
function pruefeSpielProzesse() {
  if (process.platform !== 'win32') return;
  execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
    if (err) return;
    const namen = new Set(String(out).split(/\r?\n/).map((z) => (z.split('","')[0] || '').replace(/^"/, '').toLowerCase()));
    const gefunden = Object.entries(SPIEL_PROZESSE).filter(([exe]) => namen.has(exe)).map(([, n]) => n).join(', ');
    if (gefunden !== spielAufRegie) { spielAufRegie = gefunden; statusMelden(); }
  });
}

/* ── Modus Game-PC: alle bekannten Spiele → Ereignisse → Regie ─────────── */
const QUELLEN = ['cs2', 'rl']; // Spiele mit Datenquelle auf dem Game-PC
let quelle = new CsQuelle();
const gp = { letzte: 0, status: null, stand: null, fremd: 0, log: [], nr: 0, statusGesendet: 0 };
let rlQuelle = new RlQuelle();
const rl = { letzte: 0, stand: null, statusGesendet: 0 };
const rlClient = new RlClient({ onNachricht: (m) => rlNachricht(m), onChange: statusMelden });
const client = new SessionClient({
  onChange: () => { if (client.zustand !== 'verbunden') gpSim.stop(); statusMelden(); },
  onAntwort: statusMelden,
  geraet: () => ({ app: app.getVersion() }),
  karte: () => cfg.gamepc.netz,
});
const discovery = new Discovery({ onChange: () => discoveryGeaendert(), karte: () => cfg.gamepc.netz });
const gsi = new GsiServer({ onPayload: (b) => gamePcPayload(b), onStatus: statusMelden });

function gamePcPayload(body, sim = false) {
  if (cfg.modus !== 'gamepc') return;
  if (body?.auth?.token !== cfg.gamepc.gsiToken) { gp.fremd++; return statusMelden(); }
  const r = quelle.ingest(body);
  Object.assign(gp, { letzte: Date.now(), status: r.status, stand: r.stand });
  const spiel = 'cs2'; // Game-PC sendet immer alles, was er erkennt. Was davon genutzt wird, entscheidet die Regie.
  for (const ev of r.events) {
    const ok = client.event(spiel, ev);
    gamePcLog({ spiel, ev, gesendet: ok, sim });
  }
  if (r.events.length || Date.now() - gp.statusGesendet > 500) { client.status(spiel, r.status, r.stand); gp.statusGesendet = Date.now(); }
  statusMelden();
}

function gamePcLog(x) {
  const e = { id: ++gp.nr, t: Date.now(), ...x };
  gp.log.unshift(e);
  if (gp.log.length > 200) gp.log.length = 200;
  an('gamepc-event', e);
}

// Simulator des Game-PCs: spielt das aktive Spiel der Session, als liefe es auf diesem PC.
// Die Daten laufen durch dieselbe Erkennung wie echte Spieldaten. Nur mit verbundener Session.
let gpSimSpiel = 'cs2';
const gpSim = new SimRunner({
  onChange: () => statusMelden(),
  neuesMatch: () => {
    if (gpSimSpiel === 'rl') return new RlSimMatch();
    // 5 gegen 5, dieser PC ist Spieler 1 (CT): nur dessen Daten kommen hier an, wie bei echtem CS2
    const m = new SimMatch({ clients: Array.from({ length: 10 }, (_, i) => ({ token: i === 0 ? cfg.gamepc.gsiToken : `sim${i}` })) });
    m.spieler[0].name = cfg.gamepc.pcId || m.spieler[0].name;
    return m;
  },
  deliver: (p) => {
    if (gpSimSpiel === 'rl') rlNachricht(p, true);
    else if (p.auth?.token === cfg.gamepc.gsiToken) gamePcPayload(p, true);
  },
});
function gamePcSimStart(modus) {
  if (client.zustand !== 'verbunden') return { fehler: 'Nur mit verbundener Session' };
  const spiel = client.aktivesSpiel;
  if (spiel !== 'cs2' && spiel !== 'rl') return { fehler: 'Für das aktive Spiel der Session gibt es keinen Simulator' };
  if (spiel !== gpSimSpiel) { gpSim.neu(); gpSimSpiel = spiel; }
  if (spiel === 'cs2' && !gpSim.match) quelle = new CsQuelle();
  if (spiel === 'rl' && !gpSim.match) rlQuelle = new RlQuelle();
  gpSim.start(modus);
  return { ok: true };
}

// Verbinden mit der gewählten Session. Adresse und Port kommen immer aus mDNS, nie von Hand.
let autoWartet = false;
// Rocket League: Nachrichten der Stats API → Events an die Regie
function rlNachricht(m, sim = false) {
  if (cfg.modus !== 'gamepc') return;
  const r = rlQuelle.ingest(m);
  rl.letzte = Date.now();
  rl.stand = r.stand;
  for (const ev of r.events) {
    gamePcLog({ spiel: 'rl', ev, gesendet: client.event('rl', ev), sim });
  }
  if (r.events.length || Date.now() - rl.statusGesendet > 500) { client.status('rl', r.status, r.stand); rl.statusGesendet = Date.now(); }
  statusMelden();
}

function gamePcVerbinden() {
  const g = cfg.gamepc;
  const s = discovery.liste().find((x) => x.id === g.regie.id) || discovery.liste().find((x) => x.session === g.regie.session);
  if (!g.pcId.trim()) return { fehler: 'Zuerst eine PC-ID eintragen' };
  if (!g.regie.id) return { fehler: 'Zuerst eine Session wählen' };
  if (!g.passwort) return { fehler: 'Passwort fehlt' };
  if (s) g.regie = { id: s.id, session: s.session, host: s.ip, port: s.port };
  else if (!g.regie.host) return { fehler: 'Session gerade nicht im Netz' };
  autoWartet = false;
  client.verbinden({ host: g.regie.host, port: g.regie.port, passwort: g.passwort, pcId: g.pcId.trim(), spiele: QUELLEN });
  speichereKonfig();
  return { ok: true };
}
function discoveryGeaendert() {
  // Beim Start automatisch verbinden, sobald die gespeicherte Session im Netz auftaucht
  if (autoWartet && discovery.liste().some((x) => x.id === cfg.gamepc.regie.id)) gamePcVerbinden();
  statusMelden();
}

async function rlCheck() {
  const ordner = await findeRlConfigOrdner();
  let ini = null;
  try { if (ordner) ini = fs.readFileSync(path.join(ordner, RL_INI_DATEI), 'utf8'); } catch {}
  const w = leseRlIni(ini);
  const alter = rl.letzte ? Math.round((Date.now() - rl.letzte) / 1000) : null;
  const port = Number(cfg.gamepc.rlPort);
  return [
    { id: 'rl-installiert', label: 'Rocket League gefunden', ok: !!ordner, detail: ordner || 'weder bei Epic Games noch bei Steam' },
    { id: 'rl-ini', label: 'Stats API eingeschaltet', ok: ini != null && w.rate > 0, detail: ini == null ? `${RL_INI_DATEI} fehlt` : w.rate > 0 ? `${w.rate} Updates pro Sekunde` : 'PacketSendRate ist 0' },
    { id: 'rl-port', label: 'Port passt zu dieser App', ok: ini != null && (w.webPort ?? 49124) === port, detail: ini == null ? '–' : `WebSocket ${w.webPort ?? 49124}` },
    { id: 'rl-verbunden', label: 'Mit Rocket League verbunden', ok: rlClient.verbunden, detail: rlClient.verbunden ? `127.0.0.1:${port}` : 'Rocket League läuft nicht oder Stats API aus' },
    { id: 'rl-daten', label: 'Rocket League sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, ein Match starten' : `zuletzt vor ${alter} s` },
  ];
}

// „Ist korrekt aufgesetzt“-Check des Game-PCs
// CS2 und Rocket League gibt es nicht für macOS: dort nicht suchen, sondern das sagen
const OHNE_MAC = (spiel) => [{ id: 'plattform', label: `${spiel} gibt es nicht für macOS`, ok: false, warn: true, nichtVerfuegbar: true, detail: 'Game-PC mit diesem Spiel nur unter Windows' }];

async function setupCheck() {
  const g = cfg.gamepc, c = client.info(), gs = gsi.status();
  const allgemein = [
    { id: 'pcid', label: 'PC-ID eingetragen', ok: !!g.pcId.trim(), detail: g.pcId.trim() || 'fehlt' },
    { id: 'session', label: 'Mit einer Session verbunden', ok: c.zustand === 'verbunden', detail: c.zustand === 'verbunden' ? c.session : c.grund || 'nicht verbunden' },
  ];
  if (process.platform === 'darwin') return { allgemein, cs2: OHNE_MAC('Counter-Strike 2'), rl: OHNE_MAC('Rocket League'), plattform: 'darwin' };
  const ordner = await findeCs2CfgOrdner();
  const datei = ordner ? path.join(ordner, CFG_DATEI) : '';
  let inhalt = null;
  try { if (datei) inhalt = fs.readFileSync(datei, 'utf8'); } catch {}
  const norm = (x) => String(x).replace(/\r\n/g, '\n').trim();
  const passt = inhalt != null && norm(inhalt) === norm(gsiCfg({ port: g.gsiPort, token: g.gsiToken }));
  const alter = gp.letzte ? Math.round((Date.now() - gp.letzte) / 1000) : null;
  return {
    allgemein,
    plattform: process.platform,
    cs2: [
      { id: 'installiert', label: 'CS2 gefunden', ok: !!ordner, detail: ordner || 'nicht in den Steam-Bibliotheken' },
      { id: 'cfg', label: 'cfg-Datei installiert', ok: inhalt != null, detail: inhalt != null ? CFG_DATEI : 'fehlt' },
      { id: 'aktuell', label: 'cfg-Datei passt zu dieser App', ok: passt, detail: inhalt == null ? '–' : passt ? 'Port und Token stimmen' : 'veraltet, neu installieren' },
      { id: 'empfang', label: 'Empfang bereit', ok: !!gs.laeuft, detail: gs.fehler || `127.0.0.1:${gs.port}` },
      { id: 'daten', label: 'CS2 sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, CS2 starten' : `zuletzt vor ${alter} s` },
      ...(gp.fremd ? [{ id: 'token', label: 'Kein fremder Token', ok: false, detail: `${gp.fremd} Nachrichten mit falschem Token` }] : []),
    ],
    rl: await rlCheck(),
  };
}

/* ── Modus wechseln ───────────────────────────────────────────────────── */
async function modusStarten() {
  regieSim.stop();
  gpSim.neu();
  await session.schliessen();
  clearInterval(spielCheck);
  client.trennen();
  discovery.stop();
  rlClient.stop();
  await gsi.stop();
  if (cfg.modus === 'regie') {
    if (cfg.regie.session.offen && cfg.regie.session.passwort) await session.oeffnen();
    pruefeSpielProzesse();
    spielCheck = setInterval(pruefeSpielProzesse, 15000);
  }
  if (cfg.modus === 'gamepc') {
    quelle = new CsQuelle();
    await gsi.start(Number(cfg.gamepc.gsiPort));
    rlQuelle = new RlQuelle();
    rlClient.start(Number(cfg.gamepc.rlPort));
    discovery.start();
    autoWartet = !!(cfg.gamepc.autoVerbinden && cfg.gamepc.regie.id && cfg.gamepc.passwort && cfg.gamepc.pcId);
  }
  statusMelden();
}

function gesamtStatus() {
  const s = { modus: cfg.modus, jetzt: Date.now() };
  if (cfg.modus === 'regie') s.regie = { ...regie.snapshot(), session: session.status(), sim: regieSim.status(), armed: cfg.regie.armed, spielAufRegie };
  if (cfg.modus === 'gamepc') s.gamepc = { client: client.info(), sessions: discovery.liste(), discoveryFehler: discovery.fehler, gsi: gsi.status(), letzte: gp.letzte, status: gp.status, stand: gp.stand, fremd: gp.fremd, sim: { ...gpSim.status(), spiel: gpSimSpiel }, rl: { ...rlClient.status(), letzte: rl.letzte, stand: rl.stand } };
  return s;
}

/* ── Fenster ──────────────────────────────────────────────────────────── */
function createWindow() {
  // Startanimation wie im Netzwerkplaner: Controller, dessen Tasten nacheinander gedrückt werden
  const splash = new BrowserWindow({
    width: 380, height: 240, frame: false, resizable: false, center: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#131118',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.join(root, 'src', 'main', 'splash.html'));
  const iconPath = path.join(root, 'assets', 'app-icon', 'icon.png');
  mainWin = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1100, minHeight: 680,
    title: 'Advanced LAN', show: false, backgroundColor: '#131118',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(root, 'src', 'preload', 'preload.js') },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(root, 'dist-app', 'index.html'));
  let appBereit = false, animationFertig = false, gezeigt = false;
  const zeigen = () => {
    if (gezeigt || !appBereit || !animationFertig) return;
    gezeigt = true;
    splash.webContents.executeJavaScript('document.body.style.opacity="0"').catch(() => {});
    setTimeout(() => {
      hauptGezeigt = true;
      mainWin.show(); mainWin.focus();
      if (!splash.isDestroyed()) splash.close();
    }, 250);
  };
  mainWin.once('ready-to-show', () => { appBereit = true; zeigen(); });
  setTimeout(() => { animationFertig = true; zeigen(); }, 1900);
  for (const ev of ['minimize', 'restore', 'hide', 'show']) mainWin.on(ev, () => setImmediate(overlayAktualisieren));
  mainWin.on('closed', () => { if (overlayWin) overlayWin.destroy(); });
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ── Mini-Overlay (Game-PC) ───────────────────────────────────────────── */
// Kleines App-Icon mit Status-Punkt über allen Fenstern, nur solange die App minimiert ist.
// Normales Fenster ganz oben: sichtbar über Spielen im Fenster- oder randlosen Vollbild.
let overlayWin = null;
let hauptGezeigt = false; // vor dem ersten Zeigen (Startanimation) nie ein Overlay
const OVERLAY_GROESSE = 64;

function overlayErzeugen() {
  const o = cfg.gamepc.overlay || {};
  const wa = screen.getPrimaryDisplay().workArea;
  const x = Number.isFinite(o.x) ? o.x : wa.x + wa.width - OVERLAY_GROESSE - 24;
  const y = Number.isFinite(o.y) ? o.y : wa.y + 24;
  overlayWin = new BrowserWindow({
    width: OVERLAY_GROESSE, height: OVERLAY_GROESSE, x, y,
    frame: false, transparent: true, resizable: false, movable: true, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, focusable: false, show: false, alwaysOnTop: true, title: 'Advanced LAN Overlay',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(root, 'src', 'preload', 'overlay-preload.js') },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile(path.join(root, 'src', 'main', 'overlay.html'));
  overlayWin.webContents.once('did-finish-load', overlayMelden);
  overlayWin.on('closed', () => { overlayWin = null; });
}

function overlayAktualisieren() {
  const soll = cfg.modus === 'gamepc' && cfg.gamepc.overlay?.an && mainWin && !mainWin.isDestroyed() && hauptGezeigt && (mainWin.isMinimized() || !mainWin.isVisible());
  if (soll) {
    if (!overlayWin) overlayErzeugen();
    overlayWin.showInactive();
    overlayMelden();
  } else if (overlayWin) overlayWin.hide();
}

function overlayMelden() {
  if (!overlayWin || overlayWin.isDestroyed() || cfg.modus !== 'gamepc') return;
  overlayWin.webContents.send('overlay-status', overlayStatus({ client: client.info(), gsi: gsi.status(), letzteCs2: gp.letzte, letzteRl: rl.letzte, jetzt: Date.now() }));
}

ipcMain.on('overlay-ziehen', (_, dx, dy) => {
  if (!overlayWin) return;
  const [x, y] = overlayWin.getPosition();
  overlayWin.setPosition(Math.round(x + (Number(dx) || 0)), Math.round(y + (Number(dy) || 0)));
});
ipcMain.on('overlay-abgelegt', () => {
  if (!overlayWin) return;
  const [x, y] = overlayWin.getPosition();
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x, y };
  speichereKonfig();
});
ipcMain.handle('overlay-zuruecksetzen', () => {
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x: null, y: null };
  speichereKonfig();
  if (overlayWin) { overlayWin.destroy(); overlayWin = null; }
  overlayAktualisieren();
});
ipcMain.on('overlay-oeffnen', () => {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  overlayAktualisieren();
});
setInterval(overlayMelden, 2000).unref(); // Daten veralten auch ohne neue Meldung

/* ── IPC ──────────────────────────────────────────────────────────────── */
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('config-get', () => cfg);
ipcMain.handle('config-set', async (_, neu) => {
  const alt = cfg;
  cfg = { ...migrateKonfig(neu), modus: alt.modus };
  cfg.regie.armed = !!neu.regie?.armed;
  cfg.regie.session.offen = alt.regie.session.offen; // offen/zu steuern nur die Session-Knöpfe
  if (client.zustand !== 'getrennt' && client.zustand !== 'abgelehnt') cfg.gamepc.pcId = alt.gamepc.pcId; // PC-ID nur ohne aktive Session änderbar
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x: alt.gamepc.overlay?.x ?? null, y: alt.gamepc.overlay?.y ?? null }; // Position setzt nur das Overlay selbst
  speichereKonfig();
  overlayAktualisieren();
  if (cfg.modus === 'regie') {
    if (session.offen && (cfg.regie.netz.empfang !== alt.regie.netz?.empfang)) await session.oeffnen();
    if (cfg.regie.aktivesSpiel !== alt.regie.aktivesSpiel) session.spielGewechselt();
    else if (session.offen && cfg.regie.session.name !== alt.regie.session.name) session.ausrufen();
    if (session.offen && (cfg.regie.session.port !== alt.regie.session.port || cfg.regie.session.passwort !== alt.regie.session.passwort)) await session.oeffnen();
  }
  if (cfg.modus === 'gamepc' && cfg.gamepc.gsiPort !== alt.gamepc.gsiPort) await gsi.start(Number(cfg.gamepc.gsiPort));
  if (cfg.modus === 'gamepc' && cfg.gamepc.netz !== alt.gamepc.netz) {
    // Andere Karte: Sessions dort neu suchen und eine bestehende Verbindung darüber neu aufbauen
    discovery.stop(); discovery.start();
    if (client.ziel) client.verbinden(client.ziel);
  }
  statusMelden();
  return gesamtStatus();
});
ipcMain.handle('modus-setzen', async (_, modus) => {
  cfg.modus = modus === 'regie' || modus === 'gamepc' ? modus : null;
  speichereKonfig();
  await modusStarten();
  overlayAktualisieren();
  return gesamtStatus();
});
ipcMain.handle('status', () => gesamtStatus());
ipcMain.handle('netz-adressen', () => karten());

// Regie
ipcMain.handle('regie-log', () => regie.alleLogs());
ipcMain.handle('zaehler-zuruecksetzen', () => { regie.zuruecksetzen(); return true; });
ipcMain.handle('session-oeffnen', async () => { const ok = await session.oeffnen(); cfg.regie.session.offen = ok; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('session-schliessen', async () => { await session.schliessen(); cfg.regie.session.offen = false; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('pc-trennen', (_, pcId) => { session.trennen(pcId); });
ipcMain.handle('event-ausloesen', (_, ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: 'Regie', pcId: 'regie' }, 'manuell'));
ipcMain.handle('signal-testen', (_, spiel, type, zuweisung) => regie.testeZuweisung(spiel, type, zuweisung));
ipcMain.handle('ziel-testen', async (_, zielId) => {
  const ziel = cfg.regie.targets.find((t) => t.id === zielId);
  if (!ziel) return { fehler: 'Ziel nicht gefunden' };
  try { const n = testNachricht(ziel); await oscSenden({ ziel, ...n }); return { ok: true, nachricht: zeigeNachricht(n) }; }
  catch (e) { return { fehler: e.message }; }
});
ipcMain.handle('sim-start', (_, modus) => { regieSim.start(modus, cfg.regie.aktivesSpiel); return regieSim.status(); });
ipcMain.handle('sim-stop', () => { regieSim.stop(); return regieSim.status(); });
ipcMain.handle('sim-neu', () => { regieSim.neu(); return regieSim.status(); });

// Game-PC
ipcMain.handle('gamepc-log', () => gp.log);
ipcMain.handle('verbinden', () => gamePcVerbinden());
ipcMain.handle('trennen', () => { autoWartet = false; client.trennen(); });
ipcMain.handle('cs2-ordner', () => findeCs2CfgOrdner());
ipcMain.handle('setup-check', () => setupCheck());
ipcMain.handle('rl-ini-installieren', async () => {
  const ordner = await findeRlConfigOrdner();
  if (!ordner) return { fehler: 'Rocket-League-Ordner nicht gefunden. Bitte „Speichern unter …“ nehmen.' };
  try { fs.writeFileSync(path.join(ordner, RL_INI_DATEI), rlIni({ webPort: Number(cfg.gamepc.rlPort) })); }
  catch (e) { return { fehler: e.message }; }
  return { ok: true, pfad: path.join(ordner, RL_INI_DATEI) };
});
ipcMain.handle('rl-ini-speichern', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: RL_INI_DATEI, filters: [{ name: 'Rocket League Stats API', extensions: ['ini'] }] });
  if (r.canceled || !r.filePath) return { abgebrochen: true };
  fs.writeFileSync(r.filePath, rlIni({ webPort: Number(cfg.gamepc.rlPort) }));
  return { ok: true, pfad: r.filePath };
});
ipcMain.handle('cfg-installieren', async () => {
  const ordner = await findeCs2CfgOrdner();
  if (!ordner) return { fehler: 'CS2-Ordner nicht gefunden. Bitte „cfg speichern unter …“ nehmen.' };
  try { fs.writeFileSync(path.join(ordner, CFG_DATEI), gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); }
  catch (e) { return { fehler: e.message }; }
  return { ok: true, pfad: path.join(ordner, CFG_DATEI) };
});
ipcMain.handle('cfg-speichern', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: CFG_DATEI, filters: [{ name: 'CS2-Konfiguration', extensions: ['cfg'] }] });
  if (r.canceled || !r.filePath) return { abgebrochen: true };
  fs.writeFileSync(r.filePath, gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken }));
  return { ok: true, pfad: r.filePath };
});
// Einzelnes Event von diesem PC an die Regie (Tab „Simulator“)
ipcMain.handle('test-event', (_, type, spiel = 'cs2', team = '', kills = 1) => {
  const stand = spiel === 'rl' ? rl.stand : gp.stand;
  const ev = { type: String(type), team: String(team || ''), player: cfg.gamepc.pcId, kills: Number(kills) || 1, round: stand?.runde ?? 0, map: stand?.map || '', test: true };
  const ok = client.event(spiel, ev);
  gamePcLog({ spiel, ev, gesendet: ok, sim: true });
  return { ok };
});
ipcMain.handle('gamepc-sim-start', (_, modus) => gamePcSimStart(modus));
ipcMain.handle('gamepc-sim-stop', () => { gpSim.stop(); });
ipcMain.handle('gamepc-sim-neu', () => { gpSim.neu(); });
ipcMain.handle('open-external', (_, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });

/* ── Start ────────────────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(async () => {
    ladeKonfig();
    createWindow();
    await modusStarten();
  });
  app.on('window-all-closed', async () => {
    regieSim.stop();
    gpSim.stop();
    client.trennen();
    rlClient.stop();
    discovery.stop();
    await Promise.allSettled([session.schliessen(), gsi.stop()]);
    osc.close();
    app.quit();
  });
}
