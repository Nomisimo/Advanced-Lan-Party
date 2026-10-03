"use strict";
// Rocket League: Events aus der offiziellen Stats API von Psyonix (https://www.rocketleague.com/developer/stats-api).
// Das Spiel schickt Nachrichten { Event, Data } per WebSocket an Programme auf demselben PC.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess und in der Browser-Vorschau.

// Kein Event trägt die PC-ID in der Adresse: Die Stats API meldet alle Spieler des Matches, nicht nur den eigenen.
const RL_EVENT_TYPES = [
  { id: "match_start", label: "Match startet", gruppe: "Match" },
  { id: "kickoff", label: "Anstoß", gruppe: "Match" },
  { id: "overtime", label: "Verlängerung", gruppe: "Match" },
  { id: "match_end", label: "Match vorbei", gruppe: "Match", team: true },
  { id: "podium", label: "Siegerehrung", gruppe: "Match" },
  { id: "goal", label: "Tor", gruppe: "Tore", team: true },
  { id: "assist", label: "Vorlage", gruppe: "Tore", team: true },
  { id: "hat_trick", label: "Hattrick", gruppe: "Tore", team: true },
  { id: "replay_start", label: "Tor-Wiederholung startet", gruppe: "Tore" },
  { id: "replay_end", label: "Tor-Wiederholung vorbei", gruppe: "Tore" },
  { id: "shot", label: "Torschuss", gruppe: "Aktionen", team: true },
  { id: "save", label: "Parade", gruppe: "Aktionen", team: true },
  { id: "epic_save", label: "Glanzparade", gruppe: "Aktionen", team: true },
  { id: "demolition", label: "Demolition", gruppe: "Aktionen", team: true },
  { id: "crossbar", label: "Latte", gruppe: "Aktionen" },
  { id: "mvp", label: "MVP", gruppe: "Aktionen", team: true },
];

const TEAM = (n) => (Number(n) === 0 ? "BLUE" : Number(n) === 1 ? "ORANGE" : "");
// StatfeedEvent.EventName → eigenes Event. „Goal“ fehlt absichtlich: Tore kommen aus GoalScored.
const STATFEED = { Assist: "assist", HatTrick: "hat_trick", Shot: "shot", Save: "save", EpicSave: "epic_save", Demolish: "demolition", MVP: "mvp" };
const EINFACH = { MatchInitialized: "match_start", RoundStarted: "kickoff", GoalReplayStart: "replay_start", GoalReplayEnd: "replay_end", PodiumStart: "podium", CrossbarHit: "crossbar" };

const daten = (m) => {
  if (typeof m.Data === "string") { try { return JSON.parse(m.Data); } catch { return {}; } }
  return m.Data && typeof m.Data === "object" ? m.Data : {};
};
const spieler = (p) => (p ? { player: String(p.Name || ""), team: TEAM(p.TeamNum), steamid: `rl:${p.Name || ""}` } : {});

function spielStandRl(d) {
  const g = d.Game || {};
  const teams = Array.isArray(g.Teams) ? g.Teams : [];
  const score = (n) => teams.find((t) => Number(t.TeamNum) === n)?.Score ?? 0;
  return {
    blau: score(0), orange: score(1), zeit: Number(g.TimeSeconds) || 0, overtime: !!g.bOvertime,
    arena: String(g.Arena || d.Arena || ""), spieler: Array.isArray(d.Players) ? d.Players.length : 0, match: String(d.MatchGuid || ""),
  };
}

// prev: letzter UpdateState (für die Verlängerung). Gibt Events zurück.
function detectRlEvents(m, prev) {
  const d = daten(m), ev = [];
  const push = (type, extra = {}) => ev.push({ type, round: 0, ...extra });
  switch (m.Event) {
    case "GoalScored": push("goal", { ...spieler(d.Scorer), speed: Math.round(Number(d.GoalSpeed) || 0) }); break;
    case "StatfeedEvent": if (STATFEED[d.EventName]) push(STATFEED[d.EventName], spieler(d.MainTarget)); break;
    case "MatchEnded": push("match_end", { team: TEAM(d.WinnerTeamNum) }); break;
    case "UpdateState": if (prev && !prev.Game?.bOvertime && d.Game?.bOvertime) push("overtime"); break;
    default: if (EINFACH[m.Event]) push(EINFACH[m.Event]);
  }
  return ev;
}

module.exports = { RL_EVENT_TYPES, detectRlEvents, spielStandRl, TEAM, daten };
