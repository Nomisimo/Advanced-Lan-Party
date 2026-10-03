"use strict";
// Regie: nimmt Ereignisse der Game-PCs an, lässt nur das aktive Spiel durch, entdoppelt und führt die eingestellten OSC-Befehle aus.
// Ohne Netzwerk: Senden und Melden kommen von außen (Main-Prozess oder Browser-Vorschau).

const { Dedupe } = require("./events");
const { befehleFuer, zeigeNachricht } = require("./signal");
const { Statistik } = require("./statistik");

const LOG_MAX = 300;
// Zählen dasselbe wie die Filter im Event-Log, nur ohne dessen Grenze von LOG_MAX Einträgen.
// fehler = Ereignisse mit mindestens einem Fehler, gesendet = einzelne OSC-Nachrichten.
const neueZaehler = () => ({ ereignisse: 0, eingerichtet: 0, verworfen: 0, gesendet: 0, fehler: 0 });

class Regie {
  constructor({ getConfig, send, emit, now = Date.now }) {
    this.getConfig = getConfig;
    this.send = send; // ({ ziel, address, args }) → Promise
    this.emit = emit || (() => {}); // (typ, daten)
    this.now = now;
    this.pcs = new Map(); // pcId → { pcId, spiele, spiel (zuletzt gemeldet), verbunden, remote, sim, t, status, stand }
    this.stand = null; // letzter Spielstand des aktiven Spiels
    this.log = [];
    this.verworfenLog = [];
    this.dedupe = new Dedupe();
    this.zaehler = neueZaehler();
    this.nr = 0;
    this.statistik = new Statistik();
  }

  aktiv() { return this.getConfig().aktivesSpiel; }

  pcVerbunden(pcId, { spiele = [], remote = "", sim = false, geraet = {} } = {}) {
    const alt = this.pcs.get(pcId) || {};
    this.pcs.set(pcId, { ...alt, pcId, spiele, remote, sim, geraet, verbunden: true, t: this.now() });
    this.emit("status");
  }

  pcGetrennt(pcId) {
    const p = this.pcs.get(pcId);
    if (p) { p.verbunden = false; this.emit("status"); }
  }

  pcPing(pcId, ms) {
    const p = this.pcs.get(pcId);
    if (p) { p.ping = ms; p.pingT = this.now(); this.emit("status"); }
  }

  pcEntfernen(pcId) { this.pcs.delete(pcId); this.emit("status"); }

  // Status-Meldung eines Game-PCs (Spieler, Leben, Spielstand)
  pcStatus(pcId, { spiel, status, stand }) {
    const p = this.pcs.get(pcId);
    if (!p) return;
    Object.assign(p, { spiel: spiel || p.spiel, status: status || p.status, t: this.now() });
    if (stand) { p.stand = stand; if (p.spiel === this.aktiv()) this.stand = { ...stand, spiel: p.spiel, t: this.now() }; }
    this.emit("status");
  }

  // Ereignis eines Game-PCs. Nur das aktive Spiel erzeugt Signale, alles andere wird verworfen.
  pcEvent(pcId, spiel, ev) {
    const p = this.pcs.get(pcId);
    if (p) { p.t = this.now(); p.spiel = spiel; }
    const e = { ...ev, spiel, pc: pcId, pcId }, quelle = p?.sim ? "sim" : "pc";
    if (spiel !== this.aktiv()) return this.verwerfen(e, "anderes Spiel", quelle);
    if (!this.dedupe.accept(e, this.now())) return this.verwerfen(e, "doppelt", quelle); // mehrere PCs melden dieselbe Runde
    return this.fire(e, quelle);
  }

  // Verworfene Ereignisse kommen in ein eigenes Log, damit sie die echten nicht verdrängen
  verwerfen(ev, grund, quelle) {
    this.zaehler.verworfen++;
    const eintrag = { id: ++this.nr, t: this.now(), ev, quelle, verworfen: grund, scharf: false, gesperrt: true, befehle: [], fehler: [] };
    this.verworfenLog.unshift(eintrag);
    if (this.verworfenLog.length > LOG_MAX) this.verworfenLog.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    return null;
  }

  // Beide Logs, neueste zuerst
  alleLogs() { return [...this.log, ...this.verworfenLog].sort((a, b) => b.id - a.id); }

  // Führt die Befehle aus, die im Tab „Signale“ für dieses Event eingestellt sind.
  // Ohne passende Zuweisung erscheint das Ereignis nur im Log.
  fire(ev, quelle = "pc") {
    const cfg = this.getConfig(), now = this.now();
    this.zaehler.ereignisse++;
    const befehle = befehleFuer(cfg, ev);
    if (befehle.length) this.zaehler.eingerichtet++;
    const eintrag = {
      id: ++this.nr, t: now, ev, quelle, scharf: !!cfg.armed, gesperrt: befehle.length === 0,
      befehle: befehle.map((b) => ({ ziel: b.ziel?.name || "?", typ: b.ziel?.typ || "", nachrichten: b.nachrichten.map(zeigeNachricht), fehler: b.fehler })),
      fehler: befehle.filter((b) => b.fehler).map((b) => `${b.ziel?.name || "?"}: ${b.fehler}`),
    };
    if (eintrag.fehler.length) this.fehlerZaehlen(eintrag);
    if (cfg.armed) for (const b of befehle) this.ausgeben(b, eintrag);
    if (ev.spiel === this.aktiv()) this.statistik.add(ev);
    this.log.unshift(eintrag);
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    return eintrag;
  }

  // Test-Knopf einer Zuweisung im Tab „Signale“: sendet sofort, auch wenn die Ausgabe aus ist
  testeZuweisung(spiel, type, zuweisung) {
    const cfg = this.getConfig();
    const ev = { type, spiel, team: zuweisung.team || (spiel === "rl" ? "BLUE" : "CT"), player: "Testspieler", pc: zuweisung.pc || "Regie", pcId: zuweisung.pc || "Regie", round: 1 };
    const [b] = befehleFuer({ ...cfg, signale: { [spiel]: { [type]: [{ ...zuweisung, aus: false }] } } }, ev);
    const k = { nachrichten: b ? b.nachrichten.map(zeigeNachricht) : [], ziel: b?.ziel?.name || "", fehler: b?.fehler ? [b.fehler] : [] };
    if (b && !b.fehler) this.ausgeben(b, k);
    return k;
  }

  ausgeben(b, k) {
    const ziel = b.ziel;
    for (const n of b.nachrichten) {
      this.zaehler.gesendet++;
      Promise.resolve(this.send({ ziel, address: n.address, args: n.args })).catch((e) => {
        if (k.id) this.fehlerZaehlen(k);
        k.fehler.push(`${ziel.name || ziel.host}: ${e.message}`);
        this.emit("fehler", `${ziel.name || ziel.host}: ${e.message}`);
        if (k.id) this.emit("event", k); // Log-Eintrag mit dem Fehler erneut melden (gleiche ID)
      });
    }
  }

  // Jedes Ereignis zählt höchstens einmal als Fehler, egal wie viele Nachrichten scheitern
  fehlerZaehlen(k) {
    if (k.fehlerGezaehlt) return;
    k.fehlerGezaehlt = true;
    this.zaehler.fehler++;
    this.emit("status");
  }

  // Knopf „Zurücksetzen“ im Control-Tab: Zähler auf null, Event-Log leer
  zuruecksetzen() {
    this.zaehler = neueZaehler();
    this.log = [];
    this.verworfenLog = [];
    this.emit("status");
  }

  snapshot() {
    return { pcs: [...this.pcs.values()], stand: this.stand, zaehler: { ...this.zaehler }, aktivesSpiel: this.aktiv(), statistik: this.statistik.json() };
  }
}

module.exports = { Regie };
