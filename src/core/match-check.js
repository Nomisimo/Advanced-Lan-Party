"use strict";
// Prüft, ob die Game-PCs im selben Match sind. Verglichen wird der Spielstand, den jeder PC meldet:
// Rocket League hat eine eindeutige MatchGuid, CS2 liefert keine Match-ID, dort zählen Map und Spielstand.

// CS2: gleiche Map und höchstens eine Runde Unterschied (Meldungen kommen gedrosselt, am Rundenende kurz versetzt)
const csGleich = (a, b) => a.map === b.map && Math.abs(a.ct - b.ct) + Math.abs(a.tt - b.tt) <= 1;
const rlGleich = (a, b) => (a.match || b.match ? a.match === b.match : a.arena === b.arena);

// pcs: [{ pcId, spiel, stand, verbunden }]. Gibt pcId → "gleich" | "anders" | "" (kein Spielstand) zurück
// und die Referenz: der Spielstand, den die meisten PCs teilen.
function matchCheck(pcs, aktiv) {
  const gleich = aktiv === "rl" ? rlGleich : csGleich;
  const mit = pcs.filter((p) => p.verbunden && p.spiel === aktiv && p.stand && (aktiv === "rl" ? p.stand.match || p.stand.arena : p.stand.map));
  let ref = null, best = 0;
  for (const p of mit) {
    const n = mit.filter((q) => gleich(p.stand, q.stand)).length;
    if (n > best) { best = n; ref = p.stand; }
  }
  const ergebnis = {};
  for (const p of pcs) ergebnis[p.pcId] = !mit.includes(p) ? "" : gleich(p.stand, ref) ? "gleich" : "anders";
  return { ergebnis, ref, anzahl: best, gesamt: mit.length };
}

module.exports = { matchCheck };
