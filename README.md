# Advanced LAN

Eine App für die LAN-Party: Die Game-PCs melden Spielereignisse, die Regie sendet daraus OSC-Befehle an Lichtpulte, Audio- und Videosoftware (z. B. grandMA3, QLab, Reaper, Resolume). Design und Aufbau wie [Netzwerkplaner](https://github.com/Nomisimo/Netzwerkplaner) und Stromplaner, Akzentfarbe Lila.

Gebaut mit **Overwolf Electron** (`@overwolf/ow-electron`), React 18 und esbuild. Die Oberfläche wird zu einer einzelnen Datei `dist-app/index.html` gebündelt.

## Zwei Modi, eine App

| Modus | Läuft auf | Tabs |
|---|---|---|
| **Game-PC** | jedem PC, auf dem gespielt wird | Session (PC-ID, Sessions im Netz, beitreten), Setup (CS2 und Rocket League einrichten, „Ist korrekt aufgesetzt?“-Check, Mini-Overlay, Netzwerkkarte), Events, Simulator (nur mit Session), Anleitung |
| **Regie** | dem Regie-PC (ohne Spiel) | Control (aktives Spiel, Ausgabe, Verbindungscheck, Statistik, Events), Signale, Ziele, Session (mit Übersicht: PC-ID, Hostname, IP, MAC, Ping, App-Version), Setup (genutzte Spiele, Check, Netzwerkkarten), Simulator, Anleitung |

Der Modus wird beim ersten Start gewählt und lässt sich oben rechts wechseln. Alle Erklärungen stehen im Tab „Anleitung“.

- Die Regie öffnet eine **Session mit Name und Passwort**. Game-PCs sehen alle Sessions im Netz automatisch per mDNS (Multicast, Dienst `_advancedlan._tcp`), auch mehrere Regien. Keine IP- oder Port-Eingabe.
- Verbindung per WebSocket (Port 47801, falls belegt ein freier, per mDNS angekündigt). Passwort per Challenge-Response mit HMAC-SHA256.
- Die PC-ID lässt sich nur ändern, solange der PC in keiner Session ist.
- Game-PCs melden immer alle Spiele, die die App kennt. Nur die Regie entscheidet: Im Tab „Setup“ werden die genutzten Spiele gewählt, im Tab „Control“ (und nur dort) das aktive Spiel. Events anderer Spiele werden verworfen.
- Mehrere PCs melden dieselbe Runde oder Bombe: die Regie wertet jedes Event nur einmal aus.
- Die Ausgabe ist nach jedem Start **aus** (roter Knopf). Erst „AUSGABE AN“ (grün, pulsierend) schickt OSC.
- Die Zähler im Control-Tab entsprechen den Filtern im Event-Log und lassen sich zurücksetzen. Der Verbindungscheck zeigt, ob alle PCs im selben Match sind (Rocket League: Match-ID, CS2: Map und Spielstand).

- **Mini-Overlay (Game-PC):** Ist die App minimiert, zeigt ein kleines App-Icon mit Statuspunkt über allen Fenstern, ob alles läuft (grün: Session und Spieldaten ok, orange: verbindet oder keine Spieldaten, rot: keine Session oder Fehler). Verschiebbar, Klick öffnet die App, abschaltbar im Tab „Setup“. Über exklusivem Vollbild erscheint es nicht (in CS2 „Vollbild (Fenster)“ nutzen).
- **Simulator auf dem Game-PC:** spielt mit verbundener Session das aktive Spiel der Regie, als liefe es auf diesem PC, und schickt die Events wirklich an die Regie.
- **Netzwerkkarten:** Die Regie wählt getrennt, über welche Karte sie Game-PCs empfängt und über welche sie OSC sendet, jedes Ziel kann eine eigene Karte haben; der Game-PC wählt seine Karte für die Session. Die App bindet Empfang bzw. Absender an die IP der Karte (eindeutig, wenn jede Karte in einem eigenen Subnetz liegt). Netzwerk-Anforderungen (IGMP, EEE, QoS …) stehen in der Anleitung.
- **Updates wie im Netzwerkplaner:** Die App prüft beim Start die GitHub-Releases und zeigt eine neuere Version als grünen Knopf neben der Versionsnummer. Mac: Klick lädt das DMG in den Download-Ordner und öffnet es, dann die App nach „Programme“ ziehen (unsigniert, deshalb kein Austausch im Hintergrund). Windows: `electron-updater` lädt und installiert selbst, sobald es Windows-Releases gibt. Klick auf die Versionsnummer öffnet „Was ist neu?“ (`src/core/version.js`, dort bei jeder Version die Änderungen eintragen).
- **Startanimation** wie im Netzwerkplaner: Controller, dessen Knöpfe nacheinander gedrückt werden.
- CS2 und Rocket League gibt es nur für Windows. Auf dem Mac läuft die Regie; der Game-PC-Modus meldet dort, dass die Spiele fehlen.

## CS2

CS2 liefert seine Daten über Valves offizielle [Game State Integration](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration): Eine cfg-Datei im CS2-Ordner (`…\game\csgo\cfg\gamestate_integration_advancedlan.cfg`) lässt das Spiel seinen Zustand per HTTP an die App auf demselben PC schicken (`127.0.0.1:3000`). Der Game-PC installiert die Datei per Knopfdruck im Tab „Setup“ und prüft dort, ob alles stimmt. Dafür braucht es keine Overwolf-Spielereignisse (GEP) und keine Freigabe.

Erkannte Ereignisse: Match startet/vorbei, Freezetime, Runde läuft, Runde gewonnen (mit Team), Bombe gelegt/entschärft/explodiert, Kill, Headshot, 3 und 4 Kills, Ace, Tod, geblendet, Runden-MVP.

## Rocket League

Rocket League liefert seine Daten über die offizielle [Stats API](https://www.rocketleague.com/developer/stats-api) von Psyonix: `TAGame\Config\TAStatsAPI.ini` im Spielordner (Epic Games oder Steam) schaltet sie ein (`PacketSendRate=10`), dann schickt das Spiel `{ Event, Data }`-Nachrichten per WebSocket an die App auf demselben PC (`127.0.0.1:49124`). Der Game-PC schreibt die ini per Knopfdruck im Tab „Setup“.

Erkannte Ereignisse: Match startet/vorbei, Anstoß, Verlängerung, Siegerehrung, Tor, Vorlage, Hattrick, Tor-Wiederholung, Torschuss, Parade, Glanzparade, Demolition, Latte, MVP. Teams heißen `BLUE` und `ORANGE`. Die Stats API meldet alle Spieler des Matches; deshalb gibt es bei Rocket League keinen PC-Filter, nur den Team-Filter.

Valorant ist als Spiel schon wählbar, seine Datenquelle fehlt noch.

## OSC: Ziele und Signale

Die Regie sendet, **was passieren soll**.

- **Ziele**: Geräte werden aus der Ziel-Datenbank angelegt (`src/core/ziel-typen.js`), jedes mit IP, Port und ggf. Optionen (z. B. MA3-Prefix). Enthalten: QLab 5, grandMA3, ETC Eos, ChamSys MagicQ, Hog 4, Lightkey, REAPER, Ableton Live (AbletonOSC), Behringer X32/M32, Resolume, Millumin, WATCHOUT 7, disguise, MadMapper, TouchDesigner, Bitfocus Companion und ein allgemeines OSC-Gerät. grandMA2, Avolites Titan, vMix, OBS und Allen & Heath haben keinen OSC-Eingang und laufen über Companion. Die Recherche dazu steht in [`docs/osc-ziele.md`](docs/osc-ziele.md).
- **Signale**: je Spiel und Event beliebig viele Befehle `Ziel → Befehl → Werte`, optional gefiltert nach PC-ID (Spieler-Events) und Team. Beispiel Rocket League Tor: Reaper „Audio ab Marker 4“ (`/marker/4`, `/play`) und grandMA3 „Sequenz: Cue anfahren“ (`/gma3/cmd "Goto Sequence 101 Cue 3"`).
- Werte dürfen Platzhalter enthalten: `{spieler}`, `{team}`, `{pc}`, `{runde}`, `{spiel}`, `{event}`.
- Jedes Ziel kennt „Eigene OSC-Nachricht“ mit freier Adresse und Argumenten (`s:{spieler} i:3 f:0.5 T`).
- Ein Event ohne Befehl erscheint nur im Log. „Test“ in „Signale“ sendet einen Befehl sofort, „Test“ in „Ziele“ eine harmlose Testnachricht.

Einstellungen aus Version 0.1.0-beta.1 (neutrale Signale) werden übernommen: Ziele werden „Allgemeines OSC-Gerät“, die alten An/Aus-Schalter entfallen.

## Entwickeln

```bash
npm install
npm test           # Erkennung, Regie, Netzwerk (WebSocket, UDP, OSC)
npm start          # baut die Oberfläche und startet ow-electron
npm run dist:win   # Windows-Installer mit ow-electron-builder
npm run dist:mac   # macOS Intel (dmg), nur auf einem Mac
```

**Beta-Releases:** Ein Tag `v*` (z. B. `v0.1.0-beta.1`) startet `.github/workflows/release.yml`: Build für macOS Intel auf einem GitHub-Mac, Ergebnis als Vorabversion unter Releases. Unsigniert, deshalb beim ersten Start Rechtsklick → Öffnen. Apple Silicon und Windows folgen.

`dist-app/index.html` lässt sich auch direkt im Browser öffnen: Dann läuft eine Vorschau ohne Netzwerk, mit derselben Regie-Logik und dem Simulator.

| Ordner | Inhalt |
|---|---|
| `src/core` | Logik ohne Electron: Ereigniserkennung CS2 und Rocket League, Regie, Ziel-Datenbank, Signale, Statistik, Simulator, Protokoll |
| `src/main` | Hauptprozess: Session-Server, Game-PC-Verbindung, GSI-Empfang, OSC |
| `src/renderer` | Oberfläche (React): Modus-Wahl, `regie/`, `gamepc/` |
