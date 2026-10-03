"use strict";
// Versionen und Änderungen wie im Netzwerkplaner. Die Versionsnummer steht in package.json
// (SemVer, Betas als 0.x.y-beta.n). Hier stehen die Änderungen je Version für „Was ist neu?“ in der App.

const REPO = "Nomisimo/Advanced-Lan-Party";
const RELEASES_URL = `https://github.com/${REPO}/releases`;

const CHANGELOG = {
  "0.1.0-beta.4": [
    "Update-Knopf wie im Netzwerkplaner: Die App sucht beim Start nach einer neuen Version und zeigt sie oben neben der Versionsnummer. Auf dem Mac lädt ein Klick das DMG und öffnet es, unter Windows installiert sich das Update selbst",
    "„Was ist neu?“: Klick auf die Versionsnummer zeigt die Änderungen je Version und sucht nach Updates",
    "Control: Die Zähler zeigen dieselben Zahlen wie die Filter im Event-Log; „Verworfen“ zählt nur verworfene Events. Die Liste zeigt die letzten 300 und sagt das",
    "Control: Knopf „Zurücksetzen“ setzt die Zähler auf null und leert das Event-Log",
    "Verbindungscheck: Spalte „Match“ zeigt, ob alle PCs im selben Match sind (Rocket League über die Match-ID, CS2 über Map und Spielstand)",
    "Event-Log: Jede Zeile zeigt das Spiel (CS2/RL) mit Farbstreifen",
    "Mini-Overlay: Glow kleiner und nicht mehr abgeschnitten, Statuspunkt ohne Glow",
  ],
  "0.1.0-beta.3": [
    "Game-PC: Simulator-Tab, spielt mit verbundener Session das aktive Spiel und schickt die Events wirklich an die Regie",
    "Ausgabe: „AUSGABE AN“ grün und pulsierend, „AUSGABE AUS“ rot",
    "Session-Übersicht der Regie: PC-ID, Hostname, IP, MAC, Ping, App-Version und Netzwerkkarte je PC",
    "Netzwerkkarten: getrennt für Empfang und Senden, je Ziel eine eigene Karte, Game-PC wählt seine Karte",
    "Anleitung: Netzwerk-Anforderungen (Subnetz/VLAN, IGMP Snooping, EEE, QoS, PortFast, Firewall …)",
    "Setup: Links zur Dokumentation von CS2 GSI und der Rocket League Stats API",
    "Mini-Overlay für Game-PCs, Startanimation, Event-Log mit Filtern",
  ],
  "0.1.0-beta.2": [
    "OSC-Befehle statt neutraler Signale: Ziel-Datenbank (grandMA3, QLab, Eos, Resolume, Companion …) und Signale-Matrix",
    "Ziel-Info-Pop-up mit Einrichtung und Doku je Gerät",
    "Neues App-Icon, Mac-Installer wie im Netzwerkplaner",
  ],
  "0.1.0-beta.1": [
    "Erste Beta: Regie und Game-PC in einer App, Sessions per mDNS, CS2 über Game State Integration, Rocket League über die Stats API",
  ],
};

// SemVer-Vergleich inkl. Vorabversionen: 0.2.0-beta.1 < 0.2.0-beta.2 < 0.2.0
const parseVersion = (v) => {
  const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
};
const compareVersions = (a, b) => {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  if (!A.pre.length || !B.pre.length) return (A.pre.length ? -1 : 0) - (B.pre.length ? -1 : 0);
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny && +x !== +y) return +x - +y;
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
const istBeta = (v) => /-(alpha|beta|rc)/i.test(String(v || ""));

// Neueste Version aus der GitHub-Releases-Liste (ohne Entwürfe)
const neuesteVersion = (releases = []) => releases
  .filter((r) => !r.draft && parseVersion(r.tag_name))
  .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0] || null;

// Passendes Mac-DMG eines Releases (bisher nur Intel, x64)
const macDmg = (release, arch = "x64") => (release?.assets || []).find((a) => a.name.endsWith(`-mac-${arch}.dmg`)) || null;

module.exports = { REPO, RELEASES_URL, CHANGELOG, parseVersion, compareVersions, istBeta, neuesteVersion, macDmg };
