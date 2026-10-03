const { contextBridge, ipcRenderer } = require('electron');

const abo = (kanal) => (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on(kanal, h); return () => ipcRenderer.removeListener(kanal, h); };
const call = (kanal) => (...args) => ipcRenderer.invoke(kanal, ...args);

contextBridge.exposeInMainWorld('regieAPI', {
  appVersion:      call('app-version'),
  getConfig:       call('config-get'),
  setConfig:       call('config-set'),
  setModus:        call('modus-setzen'),
  status:          call('status'),
  netzAdressen:    call('netz-adressen'),
  onStatus:        abo('status'),
  onMeldung:       abo('meldung'),
  openExternal:    call('open-external'),
  // Updates (wie im Netzwerkplaner)
  fetchReleases:   call('fetch-releases'),
  checkForUpdates: call('check-for-updates'),
  installUpdate:   call('install-update'),
  macUpdateLaden:  call('mac-update-laden'),
  appBeenden:      call('app-beenden'),
  onUpdateStatus:  abo('update-status'),
  // Regie
  regieLog:        call('regie-log'),
  zaehlerZuruecksetzen: call('zaehler-zuruecksetzen'),
  sessionOeffnen:  call('session-oeffnen'),
  sessionSchliessen: call('session-schliessen'),
  pcTrennen:       call('pc-trennen'),
  eventAusloesen:  call('event-ausloesen'),
  signalTesten:    call('signal-testen'),
  zielTesten:      call('ziel-testen'),
  overlayZuruecksetzen: call('overlay-zuruecksetzen'),
  simStart:        call('sim-start'),
  simStop:         call('sim-stop'),
  simNeu:          call('sim-neu'),
  onRegieEvent:    abo('regie-event'),
  // Game-PC
  gamePcLog:       call('gamepc-log'),
  verbinden:       call('verbinden'),
  trennen:         call('trennen'),
  cs2Ordner:       call('cs2-ordner'),
  setupCheck:      call('setup-check'),
  rlIniInstallieren: call('rl-ini-installieren'),
  rlIniSpeichern:  call('rl-ini-speichern'),
  cfgInstallieren: call('cfg-installieren'),
  cfgSpeichern:    call('cfg-speichern'),
  testEvent:       call('test-event'),
  gamePcSimStart:  call('gamepc-sim-start'),
  gamePcSimStop:   call('gamepc-sim-stop'),
  gamePcSimNeu:    call('gamepc-sim-neu'),
  onGamePcEvent:   abo('gamepc-event'),
});
