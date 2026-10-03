import React from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB } from "./theme.js";
import { ZIEL_TYPEN, KATEGORIEN, OHNE_OSC } from "../core/ziel-typen.js";
import { Section, Kbd, th, td } from "./ui.jsx";
import { CFG_DATEI, CFG_ORDNER } from "../core/cfg.js";
import { RL_INI_DATEI, RL_INI_ORDNER, RL_RATE } from "../core/rl-ini.js";

// Alle Erklärungen der App stehen hier, für beide Modi. Der eigene Modus steht oben.
const P = ({ children }) => <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d0de", margin: "0 0 10px" }}>{children}</p>;
const L = ({ children }) => <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, color: "#d4d0de" }}>{children}</ul>;

const Schritt = ({ n, titel, children, onGo, goLabel }) => (
  <div style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ACCENT, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 12px rgba(157,92,255,.6)" }}>{n}</div>
    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{titel}</div>
      {children}
    </div>
    {onGo && <button style={{ ...S.smallBtn, alignSelf: "center" }} onClick={onGo}>{goLabel}</button>}
  </div>
);

const Ueberblick = () => (
  <Section title="So funktioniert Advanced LAN">
    <P>
      Eine App, zwei Modi. Auf jedem PC, auf dem gespielt wird, läuft sie als <b>Game-PC</b>. Auf dem Regie-PC läuft sie als <b>Regie</b>; dort darf kein Spiel laufen.
      Im selben Netz braucht es also mindestens zwei PCs. Es kann mehrere Regien mit je einer eigenen Session geben.
    </P>
    <P>
      Die Regie öffnet eine Session mit Name und Passwort. Game-PCs sehen alle Sessions im Netz automatisch und treten mit ihrer PC-ID bei.
      Ein Game-PC meldet immer jedes Spiel, das die App kennt. Was mit den Daten passiert, entscheidet nur die Regie: Genau ein Spiel ist dort aktiv,
      Events aller anderen Spiele werden verworfen.
    </P>
    <P>
      Die Regie sagt den Geräten, <b>was passieren soll</b>. Im Tab <b>Ziele</b> werden die Geräte aus der Ziel-Datenbank angelegt, zum Beispiel Reaper und grandMA3.
      Im Tab <b>Signale</b> wird je Event eingestellt, welcher Befehl an welches Ziel geht, zum Beispiel bei einem Tor „Audio ab Marker 4“ an Reaper und „Sequenz 101 Cue 3“ an die MA3.
    </P>
  </Section>
);

const Regie = ({ goTab }) => (
  <Section title="Regie">
    <Schritt n={1} titel="Spiele auswählen" onGo={goTab && (() => goTab("setup"))} goLabel="Setup">
      Im Tab <b>Setup</b> die Spiele anhaken, die heute gespielt werden. Nur diese erscheinen in Control und Signale. Rechts zeigt der Check, ob die Regie bereit ist,
      unter anderem ob auf diesem PC ein Spiel läuft (Windows).
    </Schritt>
    <Schritt n={2} titel="Session öffnen" onGo={goTab && (() => goTab("session"))} goLabel="Session">
      Name und Passwort festlegen, <b>Öffnen</b>. Die Session wird per mDNS im Netz angekündigt. Ändert man das Passwort, müssen alle PCs neu beitreten.
      Darunter steht, wer verbunden ist: PC-ID, Hostname, IP, MAC, Ping, App-Version und die Netzwerkkarte des PCs. Eine andere App-Version als die der Regie ist orange.
    </Schritt>
    <Schritt n={3} titel="Ziele anlegen" onGo={goTab && (() => goTab("ziele"))} goLabel="Ziele">
      Unten in der <b>Ziel-Datenbank</b> die Software oder das Gerät wählen und <b>Anlegen</b>. Dann IP-Adresse eintragen; der Port ist auf den Standard des Geräts gesetzt.
      Auf dem Gerät selbst muss OSC-Empfang eingeschaltet sein (siehe „Ziele einrichten“ unten). <b>Test</b> schickt eine harmlose Nachricht, bei QLab zum Beispiel <Kbd>/thump</Kbd>.
    </Schritt>
    <Schritt n={4} titel="Signale belegen" onGo={goTab && (() => goTab("signale"))} goLabel="Signale">
      Ein Abschnitt je genutztem Spiel, darin jedes Event. <b>+ Befehl</b> legt fest: Ziel, Befehl und Werte (zum Beispiel Sequenz und Cue). Ein Event kann beliebig viele Befehle an verschiedene Ziele senden.
      Auswählbar sind nur Ziele aus dem Tab Ziele. <b>Test</b> sendet den Befehl sofort, auch bei Ausgabe aus.
    </Schritt>
    <Schritt n={5} titel="Proben" onGo={goTab && (() => goTab("sim"))} goLabel="Simulator">
      Der Simulator spielt das aktive Spiel mit virtuellen Game-PCs und derselben Erkennung wie echte PCs: CS2 mit 10 PCs (5 gegen 5), Rocket League mit 6 PCs (3 gegen 3).
      Einzelne Events lassen sich direkt auslösen.
    </Schritt>
    <Schritt n={6} titel="Live gehen" onGo={goTab && (() => goTab("control"))} goLabel="Control">
      Im Tab <b>Control</b> das aktive Spiel wählen (nur dort) und oben <b>Ausgabe</b> einschalten (grün: AUSGABE AN, rot: AUSGABE AUS). Nach jedem Start der App ist die Ausgabe aus.
    </Schritt>
    <div style={{ marginTop: 14 }}>
      <div className="sp-section-label">Control</div>
      <L>
        <li><b>Aktives Spiel</b>: nur dessen Events werden gesendet. Die Game-PCs erfahren den Wechsel sofort.</li>
        <li><b>Ausgabe</b>: Events, verworfene Events, gesendete OSC-Nachrichten, Events mit Fehler. Die Zahlen sind dieselben wie an den Filtern im Event-Log; die Liste zeigt davon die letzten 300. <b>Zurücksetzen</b> setzt alle Zähler auf null und leert das Log.</li>
        <li><b>Verbindungscheck</b> je PC: Verbindung steht, Daten kommen (in den letzten 15 s), Spiel passt zum aktiven Spiel, Ping. Ein PC ist ok, wenn alle drei grün sind.
          Die Spalte <b>Match</b> zeigt, ob der PC im selben Match ist wie die meisten: Rocket League liefert eine eindeutige Match-ID, CS2 nicht, dort werden Map und Spielstand verglichen (eine Runde Unterschied ist erlaubt).</li>
        <li><b>Statistik</b>: Spielstand, aktuelle Runde (Kills, Headshots, Bombe, Sieger, MVP) und Match (Runden, Kills, Headshot-Quote, Multikills, Aces, Top-Spieler). Beginnt bei jedem Matchstart neu.</li>
        <li><b>Events</b>: neueste oben, darunter jeder Befehl mit Ziel und OSC-Nachricht. „nicht gesendet“ heißt Ausgabe aus, „kein Befehl“ heißt im Tab Signale nicht belegt.
          Filter: <b>Alle</b> (ohne verworfene), <b>Eingerichtet</b> (Events mit Befehl, gesendet oder nicht), <b>Fehler</b> (Befehl fehlgeschlagen oder Ziel fehlt), <b>Verworfen</b>.</li>
        <li><b>Verworfen</b> wird ein Event in zwei Fällen: Es gehört zu einem anderen Spiel als dem aktiven, oder es ist doppelt, weil mehrere PCs dasselbe melden (Rundenende, Bombe, Tor kommen von jedem PC; gesendet wird nur die erste Meldung). Verworfene Events lösen nie einen Befehl aus.</li>
      </L>
    </div>
  </Section>
);

const GamePc = ({ goTab }) => (
  <Section title="Game-PC">
    <Schritt n={1} titel="PC-ID eintragen" onGo={goTab && (() => goTab("session"))} goLabel="Session">
      Am besten wie das Schild am Platz, z. B. <Kbd>PC 01</Kbd>. Die PC-ID lässt sich nur ändern, solange der PC in keiner Session ist.
    </Schritt>
    <Schritt n={2} titel="Session beitreten">
      Alle Sessions im Netz erscheinen von selbst, auch wenn es mehrere Regien gibt. Session antippen, Passwort eingeben, <b>Beitreten</b>.
      Adresse und Port kommen automatisch per mDNS, es gibt nichts einzutippen. Mit „Beim Start automatisch beitreten“ verbindet sich der PC nach einem Neustart selbst,
      sobald die Session wieder im Netz ist.
    </Schritt>
    <Schritt n={3} titel="Spiele einrichten" onGo={goTab && (() => goTab("setup"))} goLabel="Setup">
      Im Tab <b>Setup</b> einmal je Spiel: bei CS2 <b>cfg installieren</b>, bei Rocket League <b>Stats API einschalten</b>, danach das Spiel neu starten.
      Der Check „Ist korrekt aufgesetzt?“ zeigt für jedes Spiel, ob alles stimmt. Findet die App ein Spiel nicht, mit „Speichern unter …“ speichern und die Datei
      von Hand ablegen: <Kbd>{CFG_DATEI}</Kbd> nach <Kbd>{CFG_ORDNER}</Kbd>, <Kbd>{RL_INI_DATEI}</Kbd> nach <Kbd>{RL_INI_ORDNER}</Kbd>.
    </Schritt>
    <Schritt n={4} titel="Proben" onGo={goTab && (() => goTab("sim"))} goLabel="Simulator">
      Nur mit verbundener Session: Der Tab <b>Simulator</b> spielt das aktive Spiel der Regie, als liefe es auf diesem PC (bei CS2 als Spieler 1 in einem 5 gegen 5).
      Die Daten laufen durch dieselbe Erkennung wie echte Spieldaten und gehen wirklich an die Regie. Einzelne Events lassen sich auch direkt auslösen.
      Ist bei der Regie die Ausgabe an, lösen sie echte Befehle aus.
    </Schritt>
    <Schritt n={5} titel="Spielen" onGo={goTab && (() => goTab("events"))} goLabel="Events">
      Der PC schickt alle erkannten Events aller Spiele an die Regie. Im Tab <b>Events</b> steht, was rausging; simulierte Events sind markiert.
    </Schritt>
    <P>
      <b>Mini-Overlay:</b> Ist die App minimiert, zeigt ein kleines App-Icon über allen Fenstern, ob alles läuft. Grün: Session verbunden und ein Spiel liefert Daten.
      Orange: verbindet gerade oder kein Spiel liefert Daten. Rot: keine Session, abgelehnt oder CS2-Empfang gestört. Das Icon lässt sich verschieben, ein Klick öffnet die App.
      Ein- und ausschalten im Tab <b>Setup</b>. Über Spielen im exklusiven Vollbild erscheint es nicht; in CS2 dafür „Vollbild (Fenster)“ wählen.
    </P>
    <P><span style={{ color: SUB }}>
      CS2 und Rocket League gibt es nur für Windows. Auf dem Mac läuft die Regie; der Game-PC-Modus zeigt dort, dass es die Spiele nicht gibt.
    </span></P>
  </Section>
);

const Cs2 = () => (
  <Section title="CS2">
    <P>
      CS2 liefert seine Daten über Valves offizielle <b>Game State Integration</b>: Die cfg-Datei im CS2-Ordner lässt das Spiel seinen Zustand per HTTP an die App
      auf demselben PC schicken (<Kbd>127.0.0.1:3000</Kbd>, mit eigenem Token je PC). Das braucht keine Freigabe und keine Overwolf-Spielereignisse.
    </P>
    <P>
      Erkannt werden: Match startet und vorbei, Freezetime, Runde läuft, Runde gewonnen, Bombe gelegt, entschärft und explodiert, Kill, Headshot, 3 und 4 Kills, Ace,
      Spieler stirbt, geblendet, Runden-MVP. Runde, Bombe und Match melden alle PCs; die Regie wertet jedes Event nur einmal aus.
      Ein Observer- oder GOTV-PC als Game-PC meldet alle Spieler auf einmal.
    </P>
  </Section>
);

const Rl = () => (
  <Section title="Rocket League">
    <P>
      Rocket League liefert seine Daten über die offizielle <b>Stats API</b> von Psyonix. Die Datei <Kbd>{RL_INI_DATEI}</Kbd> im Ordner <Kbd>TAGame\Config</Kbd> schaltet sie ein
      (<Kbd>PacketSendRate={RL_RATE}</Kbd>); dann schickt das Spiel seine Daten per WebSocket an die App auf demselben PC (<Kbd>127.0.0.1:49124</Kbd>). Gefunden wird Rocket League bei Epic Games und Steam.
    </P>
    <P>
      Erkannt werden: Match startet und vorbei, Anstoß, Verlängerung, Siegerehrung, Tor, Vorlage, Hattrick, Tor-Wiederholung, Torschuss, Parade, Glanzparade, Demolition, Latte, MVP.
      Teams heißen <Kbd>BLUE</Kbd> und <Kbd>ORANGE</Kbd>. Die Stats API meldet alle Spieler des Matches, deshalb tragen Rocket-League-Events den Spieler als Argument, aber keine PC-ID in der Adresse.
      Alle PCs im selben Match melden dasselbe; die Regie wertet jedes Event nur einmal aus.
    </P>
    <P>Valorant lässt sich in der Regie schon auswählen, seine Datenquelle kommt später.</P>
  </Section>
);

const Osc = () => (
  <Section title="Signale und Befehle">
    <P>
      Jeder Befehl im Tab Signale gilt für ein Event. Zwei Filter grenzen ihn ein: <b>PC</b> (nur bei Spieler-Events wie Kill oder Headshot, leer heißt alle PCs)
      und <b>Team</b> (leer heißt beide Teams). So kann ein Kill von PC 03 einen eigenen Cue auslösen, ein Rundensieg von CT einen anderen als von T.
    </P>
    <P>In jedem Wert dürfen Platzhalter stehen, die beim Senden aus dem Event gefüllt werden:</P>
    <table style={{ ...S.table, marginTop: 0, marginBottom: 12 }}>
      <tbody>
        {[["{spieler}", "Spielername"], ["{team}", "CT, T, BLUE, ORANGE"], ["{pc}", "PC-ID des meldenden PCs"], ["{runde}", "Rundennummer (CS2)"], ["{spiel}", "cs2, rl"], ["{event}", "Event-ID, z. B. goal"]].map(([k, v]) => (
          <tr key={k}><td style={td({ ...S.mono, width: 120 })}>{k}</td><td style={td()}>{v}</td></tr>
        ))}
      </tbody>
    </table>
    <P>
      <b>Eigene OSC-Nachricht</b> gibt es bei jedem Ziel: Adresse frei, Argumente als Text mit Typ, zum Beispiel <Kbd>s:{"{spieler}"} i:3 f:0.5 T</Kbd>.
      Ohne Typ wird geraten: ganze Zahl <Kbd>i</Kbd>, Kommazahl <Kbd>f</Kbd>, sonst Text <Kbd>s</Kbd>. Texte mit Leerzeichen in Anführungszeichen.
    </P>
  </Section>
);

const KAT_NAME = Object.fromEntries(KATEGORIEN.map((k) => [k.id, k.name]));
const ZieleEinrichten = () => (
  <Section title="Ziele einrichten">
    <P>Alle Ziele empfangen per UDP. Auf dem Gerät muss OSC-Empfang an sein, und der Port muss zu dem im Tab Ziele passen.</P>
    <table style={{ ...S.table, marginTop: 0 }}>
      <thead><tr><th style={th()}>Ziel</th><th style={th()}>Port</th><th style={th()}>Auf dem Gerät</th><th style={th()}>Befehle</th></tr></thead>
      <tbody>
        {ZIEL_TYPEN.map((t) => (
          <tr key={t.id}>
            <td style={td({ verticalAlign: "top", width: 170 })}><b>{t.name}</b><div style={{ fontSize: 11, color: SUB }}>{KAT_NAME[t.kategorie]}{t.hersteller ? ` · ${t.hersteller}` : ""}</div></td>
            <td style={td({ ...S.mono, verticalAlign: "top" })}>{t.port}</td>
            <td style={td({ verticalAlign: "top", fontSize: 12, lineHeight: 1.6 })}>{t.einrichten}<div><a href={t.doku} target="_blank" rel="noreferrer" style={{ color: ACCENT_HI, fontSize: 11 }}>Dokumentation</a></div></td>
            <td style={td({ verticalAlign: "top", fontSize: 12, color: SUB, lineHeight: 1.6 })}>{t.befehle.map((b) => b.label).join(", ") || "eigene Nachricht"}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <P><br /><b>Ohne OSC-Eingang</b> (laut Recherche), steuerbar über Bitfocus Companion:</P>
    <L>{OHNE_OSC.map((o) => <li key={o.name}><b>{o.name}</b>: {o.weg}</li>)}</L>
  </Section>
);

const Netz = () => (
  <Section title="Netzwerk">
    <L>
      <li>Sessions finden: mDNS (Multicast <Kbd>224.0.0.251:5353</Kbd>, Dienst <Kbd>_advancedlan._tcp</Kbd>). Alle PCs müssen im selben Netz sein, Multicast darf im Switch nicht gesperrt sein.</li>
      <li>Verbindung: WebSocket auf Port <Kbd>47801</Kbd>. Ist er belegt, nimmt die Regie einen freien Port und kündigt ihn per mDNS an.</li>
      <li>Das Passwort geht nicht im Klartext übers Netz (Challenge-Response mit HMAC-SHA256).</li>
      <li>Bricht die Verbindung ab, verbindet sich der Game-PC selbst neu. Events aus der Pause werden nicht nachgeschickt, damit nichts zur falschen Zeit kommt.</li>
      <li>Die Spiele senden nur an die App auf demselben PC: CS2 an <Kbd>127.0.0.1:3000</Kbd>, Rocket League auf <Kbd>127.0.0.1:49124</Kbd>. Dafür muss nichts in der Firewall freigegeben werden.</li>
      <li>Windows-Firewall: auf der Regie eingehend TCP 47801 erlauben, auf allen PCs UDP 5353. Beim ersten Start fragt Windows meist selbst.</li>
      <li><b>Netzwerkkarten</b>: Die Regie wählt im Tab <b>Setup</b> getrennt, über welche Karte sie Game-PCs empfängt und über welche sie OSC sendet; im Tab <b>Ziele</b> kann jedes Ziel eine eigene Karte bekommen.
        Der Game-PC wählt seine Karte im Tab <b>Setup</b>. Die App bindet Empfang und Absender an die IP der Karte. Das ist eindeutig, wenn jede Karte in einem eigenen Netz (Subnetz) liegt, z. B. LAN <Kbd>192.168.1.x</Kbd> und Licht <Kbd>2.x.x.x</Kbd>.
        Liegen zwei Karten im selben Subnetz, entscheidet das Betriebssystem nach seiner Routing-Tabelle. Liegt ein Ziel nicht im Netz der gewählten Karte, zeigt der Tab Ziele einen Hinweis.</li>
      <li style={{ color: SUB }}>Der Modus (Regie oder Game-PC) lässt sich oben rechts wechseln.</li>
    </L>
  </Section>
);

// Was Switch, Router und Netzwerkkarten können oder lassen müssen
const ANFORDERUNGEN = [
  ["Ein Netz (Subnetz, VLAN)", "Regie und alle Game-PCs im selben", "mDNS (Multicast 224.0.0.251) geht nicht über Router oder VLAN-Grenzen. Bei getrennten VLANs braucht es einen mDNS-Repeater (Reflector) im Router."],
  ["IGMP Snooping", "darf an bleiben", "224.0.0.251 ist eine lokale Adresse (224.0.0.x), die Switches mit Snooping immer an alle Ports weitergeben. Tauchen Sessions trotzdem nicht auf: IGMP Querier einschalten oder Snooping aus."],
  ["Multicast-Filter, Storm Control", "mDNS nicht sperren", "Manche Switches filtern unbekanntes Multicast oder drosseln es bei Last. UDP 5353 an 224.0.0.251 muss durch."],
  ["EEE (Energy Efficient Ethernet, Green Ethernet, 802.3az)", "aus, an Switch und Netzwerkkarten", "Stromsparen weckt Ports erst bei Verkehr auf: kurze Aussetzer und Verzögerungen. Für Licht- und Shownetze empfehlen die Hersteller EEE grundsätzlich aus."],
  ["QoS", "nicht nötig", "Die App braucht nur wenige kB/s. Bei einem vollen Netz: Regie und OSC-Ziele hoch priorisieren (DSCP 46 oder höchste Klasse), nichts davon drosseln. Besser: Licht in ein eigenes Netz mit eigener Karte."],
  ["Spanning Tree", "PC-Ports als Edge-Port (PortFast)", "Sonst blockiert der Switch einen Port nach dem Einstecken bis zu 30 s. RSTP ist ok."],
  ["Flusskontrolle, Jumbo Frames", "egal", "Die App sendet kleine Pakete."],
  ["WLAN", "besser Kabel", "Wenn WLAN, dann Client-Isolation (AP-Isolation) aus, sonst sehen sich Regie und PCs nicht; mDNS über WLAN kann verzögert sein."],
  ["DHCP", "feste IPs oder Reservierungen für Regie und Ziele", "OSC-Ziele werden per IP angesprochen. Game-PCs finden die Regie per mDNS, auch wenn sich ihre IP ändert."],
  ["Firewall", "Regie: TCP 47801 eingehend. Alle: UDP 5353", "OSC geht ausgehend per UDP an die Ports der Ziele. Spiele senden nur an 127.0.0.1, dafür ist keine Freigabe nötig."],
];

const NetzAnforderungen = () => (
  <Section title="Netzwerk-Anforderungen">
    <P>Was am Switch, Router und an den Netzwerkkarten eingestellt sein sollte. Für ein normales LAN mit einem Switch passt meist alles ab Werk, bis auf EEE.</P>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr>{["Einstellung", "Empfehlung", "Warum"].map((h) => <th key={h} style={{ textAlign: "left", padding: "7px 8px", borderBottom: "2px solid #3a3647", color: SUB, fontSize: 11, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
      <tbody>{ANFORDERUNGEN.map(([a, b, c]) => (
        <tr key={a}>
          <td style={{ padding: "7px 8px", borderBottom: "1px solid #3a3647", fontWeight: 700, verticalAlign: "top", width: "22%" }}>{a}</td>
          <td style={{ padding: "7px 8px", borderBottom: "1px solid #3a3647", color: "#d9c6ff", verticalAlign: "top", width: "24%" }}>{b}</td>
          <td style={{ padding: "7px 8px", borderBottom: "1px solid #3a3647", color: "#d4d0de", verticalAlign: "top", lineHeight: 1.5 }}>{c}</td>
        </tr>
      ))}</tbody>
    </table>
    <P><span style={{ color: SUB }}>Ping im Tab Session der Regie: im kabelgebundenen LAN unter 1 bis 2 ms. Werte über 10 ms deuten auf WLAN, einen überlasteten Switch oder EEE hin.</span></P>
  </Section>
);

export default function AnleitungTab({ modus, goTab }) {
  return (
    <>
      <Ueberblick />
      {modus === "gamepc" ? <><GamePc goTab={goTab} /><Regie /></> : <><Regie goTab={goTab} /><GamePc /></>}
      <Cs2 />
      <Rl />
      <Osc />
      <ZieleEinrichten />
      <Netz />
      <NetzAnforderungen />
    </>
  );
}
