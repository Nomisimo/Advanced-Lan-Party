import React, { useState, useEffect, useCallback } from "react";
import { S, LINE, SUB, OK, ACCENT } from "./theme.js";
import { api } from "./api.js";
import { CHANGELOG, RELEASES_URL, compareVersions, neuesteVersion, istBeta, macDmg } from "../core/version.js";
import { ArrowUpCircle, Download, Power, ScrollText, X } from "lucide-react";

// Update-Suche wie im Netzwerkplaner: beim Start und auf Knopfdruck GitHub-Releases prüfen.
// Windows: electron-updater lädt und installiert selbst. macOS: DMG laden und öffnen (App nicht mit Apple-ID signiert).
export function useUpdate(version) {
  const [update, setUpdate] = useState(null); // { tag, url, dmg } wenn neuer als die laufende Version
  const [status, setStatus] = useState("");
  const [changelog, setChangelog] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [macUpdate, setMacUpdate] = useState(false);

  const suchen = useCallback(async (manuell = false) => {
    if (!version) return;
    if (manuell) setStatus("Suche …");
    const list = await api.fetchReleases().catch(() => null);
    if (!list) { if (manuell) setStatus("GitHub nicht erreichbar."); return; }
    const n = neuesteVersion(istBeta(version) ? list : list.filter((r) => !r.prerelease));
    if (n && compareVersions(n.tag_name, version) > 0) {
      setUpdate((u) => ({ ...u, tag: n.tag_name.replace(/^v/, ""), url: n.html_url || RELEASES_URL, dmg: macDmg(n)?.url || "" }));
      setStatus((s) => (/geladen|bereit|geöffnet/.test(s) ? s : `Neue Version ${n.tag_name} verfügbar.`));
    } else if (manuell) setStatus(`Du nutzt die neueste Version (${version}).`);
    if (manuell) api.checkForUpdates();
  }, [version]);

  useEffect(() => { suchen(false); }, [suchen]);
  useEffect(() => { api.checkForUpdates().then((r) => { setAutoUpdate(!!r?.auto); setMacUpdate(!!r?.mac); }).catch(() => {}); }, []);
  useEffect(() => api.onUpdateStatus((m) => {
    if (m.type === "available") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag })); setStatus(`Version ${m.version} wird geladen …`); }
    else if (m.type === "downloading") setStatus(`Update wird geladen … ${m.percent} %`);
    else if (m.type === "installing-after-download") setStatus("Update wird geladen und danach automatisch installiert …");
    else if (m.type === "downloaded") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag, bereit: true })); setStatus(`Version ${m.version || ""} ist bereit. „Neu starten“ installiert sie.`); }
    else if (m.type === "mac-dmg-offen") { setUpdate((u) => ({ url: RELEASES_URL, ...u, macOffen: true })); setStatus(`Version ${m.version} ist geöffnet. Advanced LAN beenden, im Finder-Fenster auf „Programme“ ziehen, „Ersetzen“ wählen und neu starten.`); setChangelog(true); }
    else if (m.type === "error") setStatus((s) => (/verfügbar/.test(s) ? s : "Automatisches Update nicht möglich. Download-Seite nutzen."));
  }), []);

  const ausfuehren = () => {
    if (macUpdate && update?.tag && update.dmg) {
      setChangelog(true);
      if (update.macOffen) return;
      api.macUpdateLaden({ tag: update.tag, url: update.dmg }).then((r) => !r?.ok && setStatus("Download läuft schon oder ist nicht möglich. Download-Seite nutzen."));
      return;
    }
    return autoUpdate || update?.bereit ? api.installUpdate() : api.installUpdate(update?.url || RELEASES_URL);
  };

  return { update, status, changelog, setChangelog, autoUpdate, macUpdate: macUpdate && !!update?.dmg, suchen, ausfuehren };
}

// Versionsnummer im Kopf: Klick öffnet „Was ist neu?“
export const VersionKnopf = ({ version, u }) => (
  <button onClick={() => u.setChangelog(true)} title="Version und Änderungen" style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 10, color: SUB, fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>v{version}</button>
);

// Grüner Knopf, sobald eine neuere Version auf GitHub liegt
export const UpdateKnopf = ({ u }) => !u.update?.tag ? null : (
  <button onClick={u.ausfuehren} title={u.autoUpdate ? "Update automatisch installieren" : u.macUpdate ? "Update laden und öffnen" : "Download-Seite öffnen"}
    style={{ background: OK + "22", border: `1px solid ${OK}`, borderRadius: 10, color: OK, fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
    <ArrowUpCircle size={12} /> {u.autoUpdate || u.macUpdate ? `${u.update.tag} installieren` : `${u.update.tag} verfügbar`}
  </button>
);

export const ChangelogKnopf = ({ u }) => (
  <button style={{ ...S.ghostBtn, padding: "7px 9px" }} onClick={() => u.setChangelog(true)} title="Was ist neu?"><ScrollText size={14} /></button>
);

// Pop-up „Was ist neu?“ mit Update-Suche
export function Changelog({ version, u }) {
  const zu = () => u.setChangelog(false);
  useEffect(() => { const k = (e) => e.key === "Escape" && zu(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const { update } = u;
  return (
    <div onClick={zu} style={{ position: "fixed", inset: 0, background: "rgba(8,6,12,.72)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#23212c", border: `1px solid ${ACCENT}`, boxShadow: "0 0 30px rgba(157,92,255,.35)", borderRadius: 12, width: "min(760px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ ...S.h2, margin: 0, fontSize: 20, flex: 1 }}>Advanced LAN {version}</h2>
          <button onClick={zu} style={{ ...S.smallBtn, padding: 6 }} title="Schließen"><X size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <button style={S.secondaryBtn} onClick={() => u.suchen(true)}>Nach Updates suchen</button>
          {update?.tag && u.autoUpdate && <button style={S.primaryBtn} onClick={u.ausfuehren} title="Lädt das Update (falls nötig), beendet die App, installiert und startet neu"><ArrowUpCircle size={14} /> {update.bereit ? "Neu starten und installieren" : `${update.tag} automatisch installieren`}</button>}
          {update?.tag && u.macUpdate && !update.macOffen && <button style={S.primaryBtn} onClick={u.ausfuehren} title="Lädt das passende DMG in den Download-Ordner und öffnet es. Danach die App nach „Programme“ ziehen."><ArrowUpCircle size={14} /> {update.tag} laden und öffnen</button>}
          {update?.tag && u.macUpdate && update.macOffen && <button style={S.primaryBtn} onClick={() => api.appBeenden()} title="Beendet Advanced LAN, damit du die neue Version nach „Programme“ ziehen kannst. Laufende Session wird beendet."><Power size={14} /> Advanced LAN beenden</button>}
          {update?.tag && !u.autoUpdate && !u.macUpdate && <button style={S.primaryBtn} onClick={u.ausfuehren} title="Öffnet die Download-Seite."><Download size={14} /> {update.tag} herunterladen</button>}
          <button style={S.ghostBtn} onClick={() => api.openExternal(update?.url || RELEASES_URL)}>Alle Versionen auf GitHub</button>
          <span style={{ fontSize: 12, color: update ? OK : SUB }}>{u.status}</span>
        </div>
        {Object.entries(CHANGELOG).map(([v, items]) => (
          <div key={v}>
            <div className="sp-section-label">Version {v}{v === version ? " (installiert)" : ""}</div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
