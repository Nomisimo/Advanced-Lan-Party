import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, Check, TeamChip, SpielChip, Kbd, Toggle, KartenWahl, useKarten } from "../ui.jsx";
import { karteFuer } from "../../core/netzwerk.js";
import { overlayStatus } from "../../core/overlay-status.js";
import { SPIELE } from "../../core/spiele.js";
import { CFG_ORDNER, CFG_DATEI } from "../../core/cfg.js";
import { RL_INI_DATEI, RL_INI_ORDNER } from "../../core/rl-ini.js";
import { FileDown, Download, RefreshCw, LocateFixed, BookOpen } from "lucide-react";

// Offizielle Dokumentation der Datenquellen, öffnet im Browser
const DOKU = {
  cs2: [
    ["Valve: Game State Integration", "https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration"],
  ],
  rl: [
    ["Psyonix: Rocket League Stats API", "https://www.rocketleague.com/developer/stats-api"],
  ],
};
const DokuLinks = ({ spiel }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
    {DOKU[spiel].map(([titel, url]) => (
      <button key={url} style={{ ...S.smallBtn, padding: "5px 9px" }} title={url} onClick={() => api.openExternal(url)}><BookOpen size={12} /> {titel}</button>
    ))}
  </div>
);

const Liste = ({ punkte }) => <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.id} {...p} />)}</div>;

const PUNKT = { ok: OK, warn: WARN, err: "#ff5d5d" };

// Vorschau des Mini-Overlays mit derselben Ampel wie das echte
function OverlayVorschau({ farbe }) {
  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 8, borderRadius: 13, background: "radial-gradient(circle at 50% 38%, #2a2238, #16131d)", border: "2px solid #9d5cff", boxShadow: "0 0 5px rgba(157,92,255,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="36 160 440 262" style={{ width: "70%", filter: "drop-shadow(0 0 4px rgba(157,92,255,.8))" }}>
          <path fill="#a874ff" d="M150 168h212c44 0 74 26 86 70l26 98c11 42-14 78-52 78-24 0-40-14-54-34l-22-32c-8-11-18-16-32-16h-116c-14 0-24 5-32 16l-22 32c-14 20-30 34-54 34-38 0-63-36-52-78l26-98c12-44 42-70 86-70z" />
          <g fill="#16131d"><rect x="148" y="236" width="68" height="22" rx="6" /><rect x="171" y="213" width="22" height="68" rx="6" /><circle cx="350" cy="226" r="15" /><circle cx="384" cy="258" r="15" /><circle cx="316" cy="258" r="15" /><circle cx="350" cy="290" r="15" /></g>
        </svg>
      </div>
      <div style={{ position: "absolute", right: 3, top: 3, width: 12, height: 12, borderRadius: "50%", border: "2px solid #16131d", background: PUNKT[farbe] }} />
    </div>
  );
}

// Über welche Karte der PC Sessions sucht und mit der Regie spricht
function Netzwerkkarte({ cfg, mutate }) {
  const karten = useKarten();
  const k = karteFuer(karten, cfg.netz) || (!cfg.netz && karten.length === 1 ? karten[0] : null);
  return (
    <Section title="Netzwerkkarte" subtitle="Über diese Karte sucht der PC Sessions und spricht mit der Regie. Nach einem Wechsel verbindet er sich neu.">
      <KartenWahl karten={karten} wert={cfg.netz} onChange={(v) => mutate((d) => { d.netz = v; })} style={{ fontSize: 14, padding: "8px 10px" }} />
      <div style={{ ...S.mono, fontSize: 11, color: SUB, marginTop: 8 }}>
        {k ? `${k.ip} / ${k.maske} · MAC ${k.mac}` : cfg.netz ? <span style={{ color: "#ff5d5d" }}>Karte nicht verbunden</span> : `${karten.length} Karten, das Betriebssystem wählt`}
      </div>
    </Section>
  );
}

export default function SetupTab({ cfg, mutate, g, jetzt, notify }) {
  const [check, setCheck] = useState(null);
  const laden = () => api.setupCheck().then(setCheck);
  useEffect(() => { laden(); const t = setInterval(laden, 3000); return () => clearInterval(t); }, []);
  const fertig = async (r, text) => { if (r?.ok) notify(text); else if (r?.fehler) notify(r.fehler, "err"); laden(); };
  const alle = check ? [...check.allgemein, ...check.cs2, ...check.rl].filter((p) => !p.nichtVerfuegbar) : [];
  const mac = check?.plattform === "darwin";
  const ampel = overlayStatus({ client: g.client, gsi: g.gsi, letzteCs2: g.letzte, letzteRl: g.rl?.letzte, jetzt });
  const offen = alle.filter((p) => !p.ok).length;

  return (
    <>
      <Section title="Ist korrekt aufgesetzt?" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        {check && <span style={{ fontSize: 13, fontWeight: 800, color: offen ? WARN : OK, textShadow: offen ? "none" : `0 0 8px ${OK}` }}>{offen ? `${offen} von ${alle.length} offen` : "Alles bereit"}</span>}
        <button style={S.smallBtn} onClick={laden}><RefreshCw size={12} /> Prüfen</button>
      </span>}>
        {check ? <Liste punkte={check.allgemein} /> : <div style={S.empty}>Prüfe …</div>}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 20, alignItems: "stretch" }}>
      <Section title="Mini-Overlay" right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Toggle checked={cfg.overlay?.an} label="Anzeigen, wenn die App minimiert ist" onChange={(v) => mutate((d) => { d.overlay = { ...(d.overlay || {}), an: v }; })} />
        <button style={S.smallBtn} onClick={async () => { await api.overlayZuruecksetzen(); notify("Overlay steht wieder oben rechts."); }}><LocateFixed size={12} /> Position zurücksetzen</button>
      </div>}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", opacity: cfg.overlay?.an ? 1 : 0.45 }}>
          <OverlayVorschau farbe={ampel.farbe} />
          <span style={{ fontSize: 13, color: PUNKT[ampel.farbe] }}>{ampel.text}</span>
        </div>
      </Section>
      <Netzwerkkarte cfg={cfg} mutate={mutate} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Counter-Strike 2 <SpielChip spiel="cs2" /></span>}
          right={!mac && <div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.cfgInstallieren(), "cfg installiert. CS2 neu starten.")}><Download size={15} /> cfg installieren</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.cfgSpeichern(), "cfg gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.cs2} />}
          {check && !mac && !check.cs2[0]?.ok && <p style={S.hint}><Kbd>{CFG_DATEI}</Kbd> → <Kbd>{CFG_ORDNER}</Kbd></p>}
          <DokuLinks spiel="cs2" />
          {g.status && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderLeft: `3px solid ${teamFarbe(g.status.team)}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.status.spieler || (g.status.zuschauer ? `schaut ${g.status.zuschauer} zu` : "im Menü")}</b>
              <TeamChip team={g.status.team} />
              {g.status.health != null && <span style={{ color: SUB }}>{g.status.health} HP · {g.status.kills}/{g.status.deaths}</span>}
              {g.stand && <span style={{ color: SUB, marginLeft: "auto" }}>{g.stand.map} · {g.stand.ct}:{g.stand.tt}</span>}
            </div>
          )}
        </Section>

        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Rocket League <SpielChip spiel="rl" /></span>}
          right={!mac && <div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.rlIniInstallieren(), "Stats API eingeschaltet. Rocket League neu starten.")}><Download size={15} /> Stats API einschalten</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.rlIniSpeichern(), "ini gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.rl} />}
          {check && !mac && !check.rl[0]?.ok && <p style={S.hint}><Kbd>{RL_INI_DATEI}</Kbd> → <Kbd>{RL_INI_ORDNER}</Kbd></p>}
          <DokuLinks spiel="rl" />
          {g.rl?.stand && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.rl.stand.arena || "Match"}</b>
              <span style={{ color: SUB }}>{g.rl.stand.spieler} Spieler</span>
              <span style={{ color: SUB, marginLeft: "auto" }}>{g.rl.stand.blau}:{g.rl.stand.orange}</span>
            </div>
          )}
        </Section>
      </div>
      <div>
        <Section title="Weitere Spiele">
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
            {SPIELE.filter((s) => s.id !== "cs2" && s.id !== "rl").map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                <SpielChip spiel={s.id} aktiv={false} />
                <span style={{ flex: 1, color: SUB }}>{s.name}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{s.quelle || "noch keine Datenquelle"}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
