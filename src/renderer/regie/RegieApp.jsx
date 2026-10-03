import React, { useState, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, GLOW_STARK } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import ControlTab from "./ControlTab.jsx";
import SetupTab from "./SetupTab.jsx";
import SignaleTab from "./SignaleTab.jsx";
import ZieleTab from "./ZieleTab.jsx";
import SimTab from "./SimTab.jsx";
import SessionTab from "./SessionTab.jsx";
import AnleitungTab from "../AnleitungTab.jsx";
import { Gauge, ListChecks, Send, FlaskConical, BookOpen, Power, Radio, KeyRound, TriangleAlert, Settings } from "lucide-react";

const TABS = [["control", "Control", Gauge], ["signale", "Signale", ListChecks], ["ziele", "Ziele", Send], ["session", "Session", KeyRound], ["setup", "Setup", Settings], ["sim", "Simulator", FlaskConical], ["hilfe", "Anleitung", BookOpen]];
const LOG_MAX = 300;
// Neuer Eintrag oben; kommt dieselbe ID wieder (z. B. mit einem Sendefehler), wird er ersetzt.
// Echte und verworfene Events haben je eigene Obergrenze.
function logEinfuegen(l, e) {
  const neu = l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l];
  let echt = 0, verw = 0;
  return neu.filter((x) => (x.verworfen ? ++verw : ++echt) <= LOG_MAX);
}

export default function RegieApp({ cfg: alles, mutate: mutateAlles, status: st, jetzt, notify, version, modusWechseln }) {
  const cfg = alles.regie;
  const status = st.regie;
  const mutate = useCallback((fn) => mutateAlles((d) => fn(d.regie)), [mutateAlles]);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem("advancedlan_regie_tab"); return TABS.some(([k]) => k === t) ? t : "control"; } catch { return "control"; } });
  useEffect(() => { try { localStorage.setItem("advancedlan_regie_tab", tab); } catch {} }, [tab]);
  useEffect(() => {
    api.regieLog().then(setLog);
    return api.onRegieEvent((e) => setLog((l) => logEinfuegen(l, e)));
  }, []);
  // Ohne offene Session zuerst dorthin
  useEffect(() => { if (!status.session.offen && !cfg.session.passwort) setTab("session"); }, []);

  const verbunden = status.pcs.filter((p) => p.verbunden);
  const aktiv = SPIEL_BY_ID[cfg.aktivesSpiel];
  const an = !!cfg.armed;
  const ses = status.session;
  const zuruecksetzen = async () => { await api.zaehlerZuruecksetzen(); setLog([]); };
  const shared = { cfg, mutate, status, log, jetzt, notify, version, goTab: setTab, zuruecksetzen };

  return (
    <div style={S.app}>
      <Kopf modus="REGIE" version={version} modusWechseln={modusWechseln} meta={<>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ses.fehler ? ERR : ses.offen ? SUB : WARN }}>
          <Radio size={12} /> {ses.fehler || (ses.offen ? `Session „${cfg.session.name}“ offen${st.vorschau ? " (Vorschau)" : ""}` : "Session geschlossen")}
        </span>
        <span> · <b style={{ color: verbunden.length ? OK : MUTED }}>{verbunden.length}</b> PCs</span>
        {status.spielAufRegie && <span style={{ color: ERR }}> · <TriangleAlert size={12} /> Auf diesem PC läuft {status.spielAufRegie}</span>}
      </>}>
        {aktiv && <span title="Aktives Spiel (Tab „Control“)" style={{ borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 12, letterSpacing: 0.5, background: aktiv.farbe, color: "#14121a", boxShadow: `0 0 12px ${aktiv.farbe}88` }}>{aktiv.kurz}</span>}
        <button onClick={() => mutate((d) => { d.armed = !d.armed; })}
          title={an ? "Ausgabe ausschalten" : "Ausgabe einschalten"}
          style={{ ...S.primaryBtn, padding: "9px 16px", letterSpacing: 0.5, background: an ? OK : ERR, border: `1px solid ${an ? OK : ERR}`, color: an ? "#0d1f14" : "#fff", boxShadow: an ? undefined : "0 0 10px rgba(255,93,93,.35)", animation: an ? "pulsGruen 1.6s ease-in-out infinite" : "none" }}>
          <Power size={15} /> {an ? "AUSGABE AN" : "AUSGABE AUS"}
        </button>
      </Kopf>
      <nav style={S.nav}>
        {TABS.map(([k, label, Ic]) => (
          <button key={k} style={{ ...S.navBtn, ...(tab === k ? S.navBtnActive : {}) }} onClick={() => setTab(k)}>
            <Ic size={14} />{label}
            {k === "control" && <span style={{ ...S.badge, background: verbunden.length ? OK + "33" : "#2f2c3a", color: verbunden.length ? OK : MUTED }}>{verbunden.length}</span>}
            {k === "session" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ses.offen ? OK : WARN, boxShadow: ses.offen ? `0 0 6px ${OK}` : "none" }} />}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "control" && <ControlTab {...shared} />}
            {tab === "setup" && <SetupTab {...shared} />}
            {tab === "signale" && <SignaleTab {...shared} />}
            {tab === "ziele" && <ZieleTab {...shared} />}
            {tab === "sim" && <SimTab {...shared} />}
            {tab === "session" && <SessionTab {...shared} />}
            {tab === "hilfe" && <AnleitungTab modus="regie" goTab={setTab} />}
          </div>
        </main>
      </div>
    </div>
  );
}
