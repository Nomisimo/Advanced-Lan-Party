const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { standardRegie } = require("../src/core/defaults");
const { matchCheck } = require("../src/core/match-check");

const ZIEL = { id: "q", typ: "osc", name: "Pult", host: "10.0.0.9", port: 8000, optionen: {} };
const SIGNALE = { cs2: { round_end: [{ id: "1", ziel: "q", befehl: "trigger", werte: { adresse: "/runde" }, pc: "", team: "" }] } };

function regieMit({ armed = false, send = () => {} } = {}) {
  const cfg = { ...standardRegie(), armed, aktivesSpiel: "cs2", targets: [ZIEL], signale: SIGNALE };
  const regie = new Regie({ getConfig: () => cfg, send });
  regie.pcVerbunden("PC 1", { spiele: ["cs2", "rl"] });
  return regie;
}

test("Zähler zählen wie die Log-Filter, auch über 300 Einträge hinaus", () => {
  const regie = regieMit();
  for (let i = 0; i < 400; i++) regie.pcEvent("PC 1", "cs2", { type: "kill", player: `A${i}`, steamid: `s${i}`, round: i, kills: 1 });
  for (let i = 0; i < 500; i++) regie.pcEvent("PC 1", "rl", { type: "goal", player: `B${i}`, round: 0 });
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "CT", round: 1 });
  const z = regie.snapshot().zaehler;
  assert.equal(z.ereignisse, 401);
  assert.equal(z.eingerichtet, 1);
  assert.equal(z.verworfen, 500, "nur verworfene Ereignisse, keine Signale");
  assert.equal(z.gesendet, 0, "Ausgabe aus");
  const logs = regie.alleLogs();
  assert.equal(logs.filter((e) => e.verworfen).length, 300, "das Log behält nur die letzten 300");
});

test("Fehler zählen je Ereignis einmal, Zurücksetzen leert Zähler und Log", async () => {
  const regie = regieMit({ armed: true, send: () => Promise.reject(new Error("weg")) });
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "CT", round: 1 });
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "T", round: 2 });
  await new Promise((r) => setImmediate(r));
  let z = regie.snapshot().zaehler;
  assert.equal(z.gesendet, 2);
  assert.equal(z.fehler, 2);
  regie.zuruecksetzen();
  z = regie.snapshot().zaehler;
  assert.deepEqual(z, { ereignisse: 0, eingerichtet: 0, verworfen: 0, gesendet: 0, fehler: 0 });
  assert.equal(regie.alleLogs().length, 0);
});

test("Match-Check: CS2 über Map und Spielstand, RL über MatchGuid", () => {
  const cs = (pcId, map, ct, tt) => ({ pcId, verbunden: true, spiel: "cs2", stand: { map, ct, tt } });
  const r = matchCheck([cs("A", "de_mirage", 3, 2), cs("B", "de_mirage", 3, 3), cs("C", "de_mirage", 3, 2), cs("D", "de_inferno", 3, 2), cs("E", "de_mirage", 0, 0),
    { pcId: "F", verbunden: true, spiel: "cs2", stand: null }], "cs2");
  assert.deepEqual(r.ergebnis, { A: "gleich", B: "gleich", C: "gleich", D: "anders", E: "anders", F: "" });
  const rl = (pcId, match) => ({ pcId, verbunden: true, spiel: "rl", stand: { match, arena: "DFH" } });
  const r2 = matchCheck([rl("A", "X1"), rl("B", "X1"), rl("C", "X2")], "rl");
  assert.deepEqual(r2.ergebnis, { A: "gleich", B: "gleich", C: "anders" });
  assert.equal(r2.anzahl, 2);
});
