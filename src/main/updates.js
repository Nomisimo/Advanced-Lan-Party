// Updates wie im Netzwerkplaner.
// Windows: electron-updater lädt die neue Version im Hintergrund und installiert sie nach Bestätigung
// (Overwolf empfiehlt für ow-electron den Electron-autoUpdater).
// macOS: die App ist nicht mit Apple-Developer-ID signiert, deshalb lädt die App das passende DMG
// wie im Browser (Gatekeeper-Schutz bleibt), öffnet es und der Nutzer zieht die App nach „Programme“.
const path = require('path');
const { REPO, RELEASES_URL } = require('../core/version');

const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
const DOWNLOAD_PREFIX = `https://github.com/${REPO}/releases/download/`;
const MANUAL_UPDATE = process.platform === 'darwin';

function einrichtenUpdates({ app, ipcMain, shell, getWin }) {
  const send = (type, payload) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('update-status', { type, ...payload }); };

  // Neueste Releases von GitHub holen (für den Update-Hinweis). Ohne Netz: null.
  ipcMain.handle('fetch-releases', async () => {
    try {
      const { net } = require('electron');
      const r = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Advanced-LAN' } });
      if (!r.ok) return null;
      const list = await r.json();
      return Array.isArray(list) ? list.map((x) => ({
        tag_name: x.tag_name, name: x.name, html_url: x.html_url, prerelease: x.prerelease, draft: x.draft, published_at: x.published_at,
        assets: (x.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
      })) : null;
    } catch { return null; }
  });

  /* Windows: electron-updater */
  let updaterAktiv = false, updateReady = false;
  ipcMain.handle('check-for-updates', () => ({ auto: updaterAktiv, mac: MANUAL_UPDATE && app.isPackaged }));
  ipcMain.handle('install-update', (_e, url) => shell.openExternal(String(url || '').startsWith(`https://github.com/${REPO}/`) ? url : RELEASES_URL));

  function autoUpdaterStarten() {
    if (MANUAL_UPDATE || !app.isPackaged) return;
    let autoUpdater;
    try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.error('electron-updater fehlt:', e?.message); return; }
    updaterAktiv = true;
    autoUpdater.allowPrerelease = app.getVersion().includes('-'); // Betas bekommen auch Betas
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => send('checking'));
    autoUpdater.on('update-not-available', () => send('up-to-date'));
    autoUpdater.on('error', (err) => { console.error('AutoUpdater:', err?.message || err); send('error', { message: err?.message || String(err) }); });
    autoUpdater.on('download-progress', (p) => send('downloading', { percent: Math.round(p.percent) }));
    autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
    let sofort = false; // „Jetzt installieren“ gedrückt, bevor der Download fertig war
    autoUpdater.on('update-downloaded', (info) => {
      updateReady = true; send('downloaded', { version: info.version });
      if (sofort) setTimeout(() => autoUpdater.quitAndInstall(false, true), 800);
    });
    ipcMain.removeHandler('check-for-updates');
    ipcMain.handle('check-for-updates', () => {
      if (updateReady) { send('downloaded'); return { auto: true }; }
      autoUpdater.checkForUpdates().catch((err) => send('error', { message: err?.message || String(err) }));
      return { auto: true };
    });
    ipcMain.removeHandler('install-update');
    ipcMain.handle('install-update', () => {
      // Fertig geladen: sofort neu starten und installieren, sonst laden und danach installieren
      if (updateReady) { autoUpdater.quitAndInstall(false, true); return { ok: true }; }
      sofort = true;
      send('installing-after-download');
      autoUpdater.checkForUpdates().catch((err) => { sofort = false; send('error', { message: err?.message || String(err) }); });
      return { ok: true };
    });
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  }

  /* macOS: DMG laden und öffnen, die App selbst tauscht nichts aus */
  let macDownload = null;
  ipcMain.handle('mac-update-laden', (_e, { tag, url } = {}) => {
    const win = getWin();
    if (!MANUAL_UPDATE || !win || macDownload) return { ok: false };
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(tag || '') || !String(url || '').startsWith(DOWNLOAD_PREFIX) || !/\.dmg$/.test(url)) return { ok: false };
    const datei = decodeURIComponent(url.split('/').pop());
    macDownload = { url, ziel: path.join(app.getPath('downloads'), datei) };
    const ses = win.webContents.session;
    const h = (_ev, item) => {
      if (!macDownload || item.getURLChain()[0] !== macDownload.url) return;
      ses.removeListener('will-download', h);
      item.setSavePath(macDownload.ziel);
      item.on('updated', () => { const t = item.getTotalBytes(); if (t) send('downloading', { percent: Math.round((item.getReceivedBytes() / t) * 100) }); });
      item.once('done', async (_e2, state) => {
        const ziel = macDownload.ziel;
        macDownload = null;
        if (state !== 'completed') return send('error', { message: `Download ${state}` });
        const err = await shell.openPath(ziel);
        if (err) return send('error', { message: err });
        send('mac-dmg-offen', { version: tag, datei: ziel });
      });
    };
    ses.on('will-download', h);
    send('downloading', { percent: 0 });
    win.webContents.downloadURL(url);
    return { ok: true };
  });
  ipcMain.handle('app-beenden', () => app.quit());

  return { autoUpdaterStarten };
}

module.exports = { einrichtenUpdates };
