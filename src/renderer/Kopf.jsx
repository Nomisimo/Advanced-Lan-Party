import React from "react";
import { S, LINE, SUB } from "./theme.js";
import APP_ICON_SVG from "../../assets/app-icon/icon.svg";
import { Repeat } from "lucide-react";
import { useUpdate, VersionKnopf, UpdateKnopf, ChangelogKnopf, Changelog } from "./Updates.jsx";
export const APP_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(APP_ICON_SVG)}`;

// Kopfzeile für beide Modi, Aufbau wie im Netzwerkplaner
export default function Kopf({ modus, version, meta, children, modusWechseln }) {
  const u = useUpdate(version);
  return (
    <header style={S.header}>
      <div style={{ ...S.logo, display: "flex", alignItems: "center", gap: 9 }}>
        <img src={APP_ICON} alt="" style={{ width: 28, height: 28, display: "block", filter: "drop-shadow(0 0 6px rgba(157,92,255,.7))" }} />ADVANCED LAN
      </div>
      <span style={{ ...S.badge, fontSize: 11, padding: "2px 8px", background: "#9d5cff22", color: "#c39bff", border: "1px solid #9d5cff66" }}>{modus}</span>
      {version && <VersionKnopf version={version} u={u} />}
      <UpdateKnopf u={u} />
      <div style={S.headerMeta}>{meta}</div>
      {children}
      <ChangelogKnopf u={u} />
      <button style={{ ...S.ghostBtn, padding: "7px 9px" }} title="Modus wechseln (Regie / Game-PC)" onClick={() => confirm("Modus wechseln? Verbindungen und Session werden dabei beendet.") && modusWechseln()}><Repeat size={14} /></button>
      {u.changelog && <Changelog version={version} u={u} />}
    </header>
  );
}
