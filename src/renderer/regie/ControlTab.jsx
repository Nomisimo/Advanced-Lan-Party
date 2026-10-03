import React, { useState } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, ERR, OK, WARN, CT, TT, BLAU, ORANGE, GLOW, teamFarbe } from "../theme.js";
import { Section, TeamChip, Dot, EventIcon, eventLabel, zeit, Leer, SpielChip, th, td } from "../ui.jsx";
import { api } from "../api.js";
import { SPIELE, SPIEL_BY_ID } from "../../core/spiele.js";
import { matchCheck } from "../../core/match-check.js";
import { Bomb, CircleCheck, CircleX, CircleMinus, Unplug, Crown, RotateCcw } from "lucide-react";

const PHASEN = { warmup: "Aufwärmen", live: "Live", intermission: "Halbzeit", gameover: "Match vorbei" };
const RUNDEN = { freezetime: "Freezetime", live: "Runde läuft", over: "Runde vorbei" };
const BOMBE = { planted: ["gelegt", ERR], defused: ["entschärft", CT], exploded: ["explodiert", TT] };
const FRISCH = 15000; // ms: so lange gelten Daten eines PCs als aktuell

/* ── Aktives Spiel: nur hier wird es gewählt ─────────────────────────── */
function SpielWahl({ cfg, mutate }) {
  const genutzt = SPIELE.filter((s) => cfg.spiele?.[s.id]);
  return (
    <Section title="Aktives Spiel">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {genutzt.map((s) => {
          const an = s.id === cfg.aktivesSpiel;
          return (
            <button key={s.id} onClick={() => !an && mutate((d) => { d.aktivesSpiel = s.id; })}
              style={{ flex: 1, minWidth: 140, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${an ? s.farbe : LINE}`,
                background: an ? s.farbe + "22" : "#1e1c26", color: "#ece9f2", boxShadow: an ? `0 0 16px ${s.farbe}66` : "none" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: an ? s.farbe : SUB, letterSpacing: 1 }}>{s.kurz}</div>
              <div style={{ fontSize: 12, color: an ? "#fff" : MUTED }}>{s.name}</div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

const Kennzahl = ({ label, wert, farbe }) => (
  <div style={{ flex: 1, minWidth: 80 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: farbe || "#fff", fontVariantNumeric: "tabular-nums" }}>{wert}</div>
    <div style={{ fontSize: 11, color: SUB }}>{label}</div>
  </div>
);

function Ausgabe({ cfg, status, zuruecksetzen, notify }) {
  const z = status.zaehler || {};
  const zurueck = async () => { if (!confirm("Zähler auf null setzen und das Event-Log leeren?")) return; await zuruecksetzen(); notify("Zähler zurückgesetzt."); };
  return (
    <Section title={cfg.armed ? "Ausgabe an" : "Ausgabe aus"} style={{ borderColor: cfg.armed ? OK : ERR, boxShadow: cfg.armed ? "0 0 16px rgba(46,204,113,.25)" : "0 0 16px rgba(255,93,93,.18)" }}
      right={<button style={S.smallBtn} title="Zähler auf null setzen und Event-Log leeren" onClick={zurueck}><RotateCcw size={12} /> Zurücksetzen</button>}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kennzahl label="Ereignisse" wert={z.ereignisse || 0} farbe={ACCENT_HI} />
        <Kennzahl label="Verworfen" wert={z.verworfen || 0} farbe={z.verworfen ? WARN : MUTED} />
        <Kennzahl label="OSC gesendet" wert={z.gesendet || 0} farbe={OK} />
        <Kennzahl label="Fehler" wert={z.fehler || 0} farbe={z.fehler ? ERR : MUTED} />
      </div>
    </Section>
  );
}

/* ── Statistik: aktuelle Runde und Match ──────────────────────────────── */
const Zahl = ({ label, wert, farbe }) => (
  <div style={{ background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", minWidth: 0 }}>
    <div style={{ fontSize: 18, fontWeight: 800, color: farbe || "#fff", fontVariantNumeric: "tabular-nums" }}>{wert}</div>
    <div style={{ fontSize: 10, color: SUB, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
  </div>
);

function Statistik({ cfg, status }) {
  const st = status.statistik;
  if (cfg.aktivesSpiel === "rl") return <RlStatistik status={status} />;
  if (cfg.aktivesSpiel !== "cs2") return <Section title="Statistik"><Leer>Keine Daten.</Leer></Section>;
  const daten = st && st.spiel === "cs2" && (st.match.runden || st.runde.nr != null || st.runde.kills);
  const stand = status.stand?.spiel === "cs2" ? status.stand : null;
  if (!daten && !stand) return <Section title="Statistik"><Leer>Noch keine Daten.</Leer></Section>;
  const r = st?.runde || {}, m = st?.match || { siege: {} };
  const bombe = BOMBE[stand?.bombe || r.bombe];
  const hs = m.kills ? Math.round((m.headshots / m.kills) * 100) : 0;
  return (
    <Section title="Statistik" right={<span style={{ display: "flex", gap: 6 }}>
      {stand?.map && <span style={S.chip}>{stand.map}</span>}
      {stand?.phase && <span style={S.chip}>{PHASEN[stand.phase] || stand.phase}</span>}
    </span>}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 14 }}>
        <Team name="CT" score={stand?.ct ?? m.siege.CT} farbe={CT} sieger={stand?.rundenPhase === "over" && stand?.sieger === "CT"} />
        <div style={{ fontSize: 24, color: MUTED }}>:</div>
        <Team name="T" score={stand?.tt ?? m.siege.T} farbe={TT} sieger={stand?.rundenPhase === "over" && stand?.sieger === "T"} />
      </div>
      <div className="sp-section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Runde {r.nr ?? stand?.runde ?? "–"}
        {(stand?.rundenPhase || r.phase) && <span style={{ ...S.chip, borderColor: ACCENT + "88", color: ACCENT_HI, textTransform: "none" }}>{RUNDEN[stand?.rundenPhase || r.phase]}</span>}
        {bombe && <span style={{ ...S.chip, borderColor: bombe[1], color: bombe[1], textTransform: "none" }}><Bomb size={11} /> {bombe[0]}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
        <Zahl label="Kills" wert={r.kills || 0} />
        <Zahl label="Headshots" wert={r.headshots || 0} />
        <Zahl label="Sieger" wert={r.sieger || "–"} farbe={r.sieger ? teamFarbe(r.sieger) : MUTED} />
        <Zahl label="MVP" wert={r.mvp || st?.letzteRunde?.mvp || "–"} farbe={r.mvp ? ACCENT_HI : MUTED} />
      </div>
      <div className="sp-section-label">Match</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
        <Zahl label="Runden" wert={m.runden || 0} />
        <Zahl label="Kills" wert={m.kills || 0} />
        <Zahl label="HS-Quote" wert={`${hs}%`} />
        <Zahl label="Multikills" wert={m.multikills || 0} />
        <Zahl label="Aces" wert={m.aces || 0} farbe={m.aces ? ACCENT_HI : undefined} />
      </div>
      {st?.top?.length > 0 && (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr><th style={th()}>Spieler</th><th style={th()}>Team</th><th style={th({ textAlign: "right" })}>K</th><th style={th({ textAlign: "right" })}>D</th><th style={th({ textAlign: "right" })}>HS</th><th style={th({ textAlign: "right" })}>MVP</th></tr></thead>
          <tbody>{st.top.map((p, i) => (
            <tr key={p.name}>
              <td style={td({ fontWeight: i === 0 ? 700 : 400 })}>{i === 0 && <Crown size={12} color={ACCENT_HI} style={{ marginRight: 5, verticalAlign: -1 }} />}{p.name}</td>
              <td style={td()}><TeamChip team={p.team} /></td>
              <td style={td({ textAlign: "right", fontWeight: 700 })}>{p.kills}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.tode}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.headshots}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.mvps}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Section>
  );
}

const uhr = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function RlStatistik({ status }) {
  const st = status.statistik?.spiel === "rl" ? status.statistik : null;
  const stand = status.stand?.spiel === "rl" ? status.stand : null;
  if (!st && !stand) return <Section title="Statistik"><Leer>Noch keine Daten.</Leer></Section>;
  const m = st?.match || { tore: {} };
  const ot = stand?.overtime || m.overtime;
  return (
    <Section title="Statistik" right={<span style={{ display: "flex", gap: 6 }}>
      {stand?.arena && <span style={S.chip}>{stand.arena}</span>}
      {m.vorbei ? <span style={S.chip}>Match vorbei</span> : ot ? <span style={{ ...S.chip, borderColor: ERR, color: ERR }}>Verlängerung</span> : null}
    </span>}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 14 }}>
        <Team name="BLUE" score={stand?.blau ?? m.tore.BLUE} farbe={BLAU} sieger={m.sieger === "BLUE"} />
        <div style={{ textAlign: "center", minWidth: 70 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: ot ? ERR : "#fff", fontVariantNumeric: "tabular-nums" }}>{ot ? "+" : ""}{uhr(stand?.zeit ?? 0)}</div>
          <div style={{ fontSize: 10, color: SUB }}>Spielzeit</div>
        </div>
        <Team name="ORANGE" score={stand?.orange ?? m.tore.ORANGE} farbe={ORANGE} sieger={m.sieger === "ORANGE"} />
      </div>
      {m.letztesTor && (
        <div className="sp-section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Letztes Tor <span style={{ color: teamFarbe(m.letztesTor.team), textTransform: "none", fontSize: 13 }}>{m.letztesTor.spieler}</span>
          {m.letztesTor.speed > 0 && <span style={{ ...S.chip, textTransform: "none" }}>{m.letztesTor.speed} km/h</span>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
        <Zahl label="Torschüsse" wert={m.schuesse || 0} />
        <Zahl label="Paraden" wert={m.paraden || 0} />
        <Zahl label="Demolitions" wert={m.demos || 0} />
        <Zahl label="Anstöße" wert={m.anstoesse || 0} />
      </div>
      {st?.top?.length > 0 && (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr><th style={th()}>Spieler</th><th style={th()}>Team</th><th style={th({ textAlign: "right" })}>Tore</th><th style={th({ textAlign: "right" })}>Vorl.</th><th style={th({ textAlign: "right" })}>Parad.</th><th style={th({ textAlign: "right" })}>Schüsse</th><th style={th({ textAlign: "right" })}>Demos</th></tr></thead>
          <tbody>{st.top.map((p, i) => (
            <tr key={p.name}>
              <td style={td({ fontWeight: i === 0 ? 700 : 400 })}>{i === 0 && <Crown size={12} color={ACCENT_HI} style={{ marginRight: 5, verticalAlign: -1 }} />}{p.name}</td>
              <td style={td()}><TeamChip team={p.team} /></td>
              <td style={td({ textAlign: "right", fontWeight: 700 })}>{p.tore}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.vorlagen}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.paraden}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.schuesse}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.demos}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Section>
  );
}

const Team = ({ name, score, farbe, sieger }) => (
  <div style={{ textAlign: "center", minWidth: 80 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: farbe, letterSpacing: 1 }}>{name}</div>
    <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05, color: "#fff", textShadow: sieger ? `0 0 18px ${farbe}` : "none" }}>{score ?? 0}</div>
  </div>
);

/* ── Verbindungscheck ─────────────────────────────────────────────────── */
const Ampel = ({ ok, teil, title }) => (
  <span title={title} style={{ display: "inline-flex", color: ok ? OK : teil ? WARN : ERR }}>
    {ok ? <CircleCheck size={15} /> : teil ? <CircleMinus size={15} /> : <CircleX size={15} />}
  </span>
);

function Verbindungscheck({ cfg, status, jetzt }) {
  const pcs = [...status.pcs].sort((a, b) => Number(b.verbunden) - Number(a.verbunden) || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  const pruefen = (p) => {
    const verbunden = !!p.verbunden;
    const daten = verbunden && p.t && jetzt - p.t < FRISCH;
    const spiel = !p.spiel || p.spiel === cfg.aktivesSpiel;
    return { verbunden, daten, spiel, ok: verbunden && daten && spiel };
  };
  const ok = pcs.filter((p) => pruefen(p).ok).length;
  const mc = matchCheck(pcs, cfg.aktivesSpiel);
  const standText = (st) => !st ? "" : cfg.aktivesSpiel === "rl" ? `${st.arena || "Arena"} · ${st.blau}:${st.orange}${st.match ? ` · Match ${st.match}` : ""}` : `${st.map} · ${st.ct}:${st.tt}`;
  return (
    <Section title="Verbindungscheck" right={pcs.length > 0 && <span style={{ display: "inline-flex", gap: 12, fontSize: 12, fontWeight: 700 }}>
      {mc.gesamt > 1 && <span style={{ color: mc.anzahl === mc.gesamt ? OK : WARN }} title={`Die meisten: ${standText(mc.ref)}`}>{mc.anzahl === mc.gesamt ? "alle im selben Match" : `${mc.gesamt - mc.anzahl} in anderem Match`}</span>}
      <span style={{ color: ok === pcs.length ? OK : WARN }}>{ok} / {pcs.length} PCs ok</span>
    </span>}>
      {pcs.length === 0 ? <Leer>Kein PC in der Session.</Leer> : (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr>
            <th style={th()}>PC</th><th style={th({ textAlign: "center" })}>Verbindung</th><th style={th({ textAlign: "center" })}>Daten</th><th style={th({ textAlign: "center" })}>Spiel</th><th style={th({ textAlign: "center" })} title="Gleiches Match wie die meisten PCs (RL: Match-ID, CS2: Map und Spielstand)">Match</th>
            <th style={th()}>Ping</th><th style={th()}>Spieler</th><th style={th()}>Erkennt</th><th style={th()}>Zuletzt</th><th style={th()}></th>
          </tr></thead>
          <tbody>
            {pcs.map((p) => {
              const c = pruefen(p), s = p.status || {};
              return (
                <tr key={p.pcId} style={{ opacity: p.verbunden ? 1 : 0.55 }}>
                  <td style={td({ fontWeight: 700, whiteSpace: "nowrap" })}><Dot color={c.ok ? OK : p.verbunden ? WARN : "#4d475c"} glow={c.ok} /> <span style={{ marginLeft: 4 }}>{p.pcId}</span>{p.sim && <span style={{ ...S.badge, marginLeft: 6, background: "#2f2c3a", color: SUB }}>SIM</span>}</td>
                  <td style={td({ textAlign: "center" })}><Ampel ok={c.verbunden} title={c.verbunden ? "verbunden" : "getrennt"} /></td>
                  <td style={td({ textAlign: "center" })}><Ampel ok={c.daten} teil={c.verbunden} title={c.daten ? "Daten kommen" : "keine aktuellen Daten"} /></td>
                  <td style={td({ textAlign: "center" })}>{p.spiel ? <SpielChip spiel={p.spiel} aktiv={c.spiel} /> : <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={td({ textAlign: "center" })}>{mc.ergebnis[p.pcId] ? <Ampel ok={mc.ergebnis[p.pcId] === "gleich"} teil
                    title={mc.ergebnis[p.pcId] === "gleich" ? `gleiches Match: ${standText(p.stand)}` : `anderes Match: ${standText(p.stand)}, die meisten: ${standText(mc.ref)}`} /> : <span style={{ color: MUTED }} title="kein Spielstand vom aktiven Spiel">–</span>}</td>
                  <td style={td({ color: p.ping == null ? MUTED : p.ping > 50 ? WARN : SUB, fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" })}>{p.sim ? "–" : p.ping == null ? "–" : `${p.ping} ms`}</td>
                  <td style={td({ fontSize: 12 })}>{s.spieler ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{s.spieler} <TeamChip team={s.team} /></span> : <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={td()}><span style={{ display: "inline-flex", gap: 4 }}>{(p.spiele || []).map((x) => <SpielChip key={x} spiel={x} aktiv={x === cfg.aktivesSpiel} />)}</span></td>
                  <td style={td({ color: SUB, fontSize: 12, whiteSpace: "nowrap" })}>{p.t ? `${Math.max(0, Math.round((jetzt - p.t) / 1000))} s` : "–"}</td>
                  <td style={td({ textAlign: "right" })}>{p.verbunden && !p.sim && <button style={S.dangerBtn} title="Trennen" onClick={() => confirm(`${p.pcId} trennen?`) && api.pcTrennen(p.pcId)}><Unplug size={12} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/* ── Log ──────────────────────────────────────────────────────────────── */
export function EventZeile({ e, neu }) {
  const team = e.ev.team, spielFarbe = SPIEL_BY_ID[e.ev.spiel]?.farbe || LINE;
  return (
    <div className={neu ? "neu" : ""} style={{ padding: "7px 10px 7px 8px", borderBottom: `1px solid ${LINE}`, borderLeft: `3px solid ${spielFarbe}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{zeit(e.t)}</span>
        <span style={{ display: "inline-flex", minWidth: 38 }}><SpielChip spiel={e.ev.spiel} /></span>
        <span style={{ color: team ? teamFarbe(team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} spiel={e.ev.spiel} /></span>
        <b style={{ fontSize: 13 }}>{eventLabel(e.ev.type, e.ev.spiel)}</b>
        <TeamChip team={team} />
        {e.ev.player && <span style={{ fontSize: 12, color: "#d4d0de" }}>{e.ev.player}{e.ev.kills > 1 && e.ev.type === "kill" ? ` (${e.ev.kills})` : ""}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: MUTED }}>{e.quelle === "manuell" ? "manuell" : e.ev.pc}</span>
      </div>
      {e.verworfen ? (
        <div style={{ fontSize: 11, marginTop: 2, paddingLeft: 112, color: WARN, display: "flex", gap: 6, alignItems: "center" }}>
          verworfen: {VERWORFEN[e.verworfen] || e.verworfen}
        </div>
      ) : e.gesperrt ? (
        <div style={{ fontSize: 11, marginTop: 2, paddingLeft: 112, color: MUTED }}>kein Befehl</div>
      ) : (e.befehle || []).map((b, i) => (
        <div key={i} style={{ ...S.mono, fontSize: 11, marginTop: 2, paddingLeft: 112, color: b.fehler ? ERR : !e.scharf ? MUTED : "#d9c6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: b.fehler ? ERR : !e.scharf ? WARN : OK }}>{b.ziel}</span>
          <span style={{ marginLeft: 8 }}>{b.fehler || b.nachrichten.join("  ·  ")}</span>
          {!e.scharf && !b.fehler && <span style={{ marginLeft: 8, color: WARN }}>nicht gesendet</span>}
        </div>
      ))}
      {e.fehler?.length > 0 && e.scharf && <div style={{ fontSize: 11, marginTop: 2, paddingLeft: 112, color: ERR }}>{e.fehler.join(", ")}</div>}
    </div>
  );
}

const VERWORFEN = { "anderes Spiel": "anderes Spiel als das aktive", doppelt: "doppelt, ein anderer PC hat es schon gemeldet" };
const hatFehler = (e) => e.fehler?.length > 0 || (e.befehle || []).some((b) => b.fehler);
// [Schlüssel, Name, Filter, Zähler der Regie]. Die Zahlen kommen aus den Zählern, die Liste hält nur die letzten 300 je Art.
const FILTER = [
  ["alle", "Alle", (e) => !e.verworfen, "ereignisse"],
  ["eingerichtet", "Eingerichtet", (e) => !e.verworfen && !e.gesperrt, "eingerichtet"],
  ["fehler", "Fehler", (e) => !e.verworfen && hatFehler(e), "fehler"],
  ["verworfen", "Verworfen", (e) => !!e.verworfen, "verworfen"],
];

function Log({ log, status }) {
  const z = status.zaehler || {};
  const [filter, setFilter] = useState(() => { try { return localStorage.getItem("advancedlan_logfilter") || "alle"; } catch { return "alle"; } });
  const waehle = (f) => { setFilter(f); try { localStorage.setItem("advancedlan_logfilter", f); } catch {} };
  const aktiv = FILTER.find(([k]) => k === filter) || FILTER[0];
  const liste = log.filter(aktiv[2]);
  const neuesteId = liste[0]?.id;
  const farbe = { fehler: ERR, verworfen: WARN };
  return (
    <Section title="Events" style={{ position: "sticky", top: 0 }} right={
      <div style={{ display: "flex", gap: 4 }}>
        {FILTER.map(([k, label, f, zk]) => {
          const n = z[zk] ?? log.filter(f).length, an = k === aktiv[0];
          return (
            <button key={k} onClick={() => waehle(k)} style={{ ...S.smallBtn, ...(an ? { borderColor: ACCENT, color: "#fff", boxShadow: GLOW } : { color: SUB }) }}>
              {label}<span style={{ ...S.badge, marginLeft: 2, background: n && farbe[k] ? farbe[k] + "33" : "#1a1820", color: n && farbe[k] ? farbe[k] : MUTED }}>{n}</span>
            </button>
          );
        })}
      </div>}>
      <div style={{ height: "calc(100vh - 400px)", minHeight: 300, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820" }}>
        {liste.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>{log.length ? "Keine Events in diesem Filter." : "Noch keine Events."}</div> : liste.map((e) => <EventZeile key={e.id} e={e} neu={e.id === neuesteId} />)}
      </div>
      {(z[aktiv[3]] ?? 0) > liste.length && liste.length > 0 && <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Die Liste zeigt die letzten {liste.length} von {z[aktiv[3]]}.</div>}
    </Section>
  );
}

export default function ControlTab({ cfg, mutate, status, log, jetzt, zuruecksetzen, notify }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
        <SpielWahl cfg={cfg} mutate={mutate} />
        <Ausgabe cfg={cfg} status={status} zuruecksetzen={zuruecksetzen} notify={notify} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <Verbindungscheck cfg={cfg} status={status} jetzt={jetzt} />
          <Statistik cfg={cfg} status={status} />
        </div>
        <Log log={log} status={status} />
      </div>
    </>
  );
}
