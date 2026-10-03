const test = require("node:test");
const assert = require("node:assert/strict");
const { RlQuelle } = require("../src/core/rl-quelle");
const { RlSimMatch } = require("../src/core/rl-sim");
const { Regie } = require("../src/core/regie");
const { RegieSim } = require("../src/core/regie-sim");
const { standardRegie } = require("../src/core/defaults");
const { rlIni, leseRlIni } = require("../src/core/rl-ini");

test("Rocket League: Stats-API-Nachrichten werden zu Events", () => {
  const q = new RlQuelle();
  const zustand = (ot) => ({ Event: "UpdateState", Data: { Players: [{}, {}], Game: { Teams: [{ TeamNum: 0, Score: 2 }, { TeamNum: 1, Score: 2 }], TimeSeconds: 0, bOvertime: ot, Arena: "DFH Stadium" } } });
  const typen = (m) => q.ingest(m, 0).events.map((e) => `${e.type}:${e.team || ""}:${e.player || ""}`);
  assert.deepEqual(typen({ Event: "MatchInitialized", Data: {} }), ["match_start::"]);
  assert.deepEqual(typen(zustand(false)), []);
  assert.deepEqual(typen(zustand(true)), ["overtime::"]);
  assert.deepEqual(q.ingest(zustand(true), 1).stand, { blau: 2, orange: 2, zeit: 0, overtime: true, arena: "DFH Stadium", spieler: 2, match: "" });
  // Data kann auch als JSON-Text kommen
  assert.deepEqual(typen({ Event: "GoalScored", Data: JSON.stringify({ Scorer: { Name: "Momo", TeamNum: 1 }, GoalSpeed: 98.6 }) }), ["goal:ORANGE:Momo"]);
  assert.deepEqual(typen({ Event: "StatfeedEvent", Data: { EventName: "Goal", MainTarget: { Name: "Momo", TeamNum: 1 } } }), [], "Tore nur aus GoalScored");
  assert.deepEqual(typen({ Event: "StatfeedEvent", Data: { EventName: "Demolish", MainTarget: { Name: "Rex", TeamNum: 0 }, SecondaryTarget: { Name: "Kira", TeamNum: 1 } } }), ["demolition:BLUE:Rex"]);
  assert.deepEqual(typen({ Event: "MatchEnded", Data: { WinnerTeamNum: 0 } }), ["match_end:BLUE:"]);
  assert.deepEqual(typen({ Event: "BallHit", Data: {} }), []);
});

test("Rocket League: Tor an Reaper und MA3, mehrere PCs zählen einmal", () => {
  let t = 0;
  const cfg = { ...standardRegie(), armed: true, aktivesSpiel: "rl",
    targets: [{ id: "r", typ: "reaper", name: "Reaper", host: "10.0.0.7", port: 8000 }, { id: "m", typ: "ma3", name: "MA3", host: "10.0.0.5", port: 8000 }],
    signale: { rl: { goal: [{ id: "1", ziel: "r", befehl: "marker_play", werte: { marker: "4" } }, { id: "2", ziel: "m", befehl: "goto_cue", werte: { seq: "101", cue: "3" }, team: "ORANGE" }] } } };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), now: () => t });
  const tor = { type: "goal", team: "ORANGE", player: "Momo", steamid: "rl:Momo", round: 0 };
  regie.pcVerbunden("PC 1", { spiele: ["cs2", "rl"] });
  regie.pcVerbunden("PC 2", { spiele: ["cs2", "rl"] });
  regie.pcEvent("PC 1", "rl", tor);
  regie.pcEvent("PC 2", "rl", tor);
  assert.deepEqual(gesendet.map((s) => [s.ziel.id, s.address, s.args.map((a) => a.value)]), [
    ["r", "/marker/4", []], ["r", "/play", []], ["m", "/gma3/cmd", ["Goto Sequence 101 Cue 3"]],
  ]);
  assert.equal(regie.snapshot().statistik.match.tore.ORANGE, 1);
});

test("Rocket League: simuliertes Match endet mit Sieger, Tore stimmen mit dem Stand überein", () => {
  for (const seed of [1, 5, 9]) {
    let t = 0;
    const cfg = { ...standardRegie(), aktivesSpiel: "rl" };
    const events = [];
    const regie = new Regie({ getConfig: () => cfg, send: () => {}, emit: (typ, d) => typ === "event" && !d.verworfen && events.push(d), now: () => t });
    const pcs = Array.from({ length: 6 }, (_, i) => ({ pcId: `PC ${i}`, quelle: new RlQuelle() }));
    pcs.forEach((p) => regie.pcVerbunden(p.pcId, { spiele: ["rl"] }));
    const m = new RlSimMatch({ seed });
    let n = 0;
    while (!m.vorbei() && n++ < 60) for (const s of m.naechsteRunde()) { t += s.dt; for (const msg of s.payloads) for (const pc of pcs) { const r = pc.quelle.ingest(msg, t); regie.pcStatus(pc.pcId, { spiel: "rl", status: r.status, stand: r.stand }); r.events.forEach((e) => regie.pcEvent(pc.pcId, "rl", e)); } }
    assert.ok(m.vorbei());
    const tore = events.filter((e) => e.ev.type === "goal");
    assert.equal(tore.length, m.blau + m.orange, "jedes Tor genau einmal");
    assert.equal(events.filter((e) => e.ev.type === "match_end").length, 1);
    assert.equal(events.find((e) => e.ev.type === "match_end").ev.team, m.blau > m.orange ? "BLUE" : "ORANGE");
    const st = regie.snapshot().statistik;
    assert.deepEqual([st.match.tore.BLUE, st.match.tore.ORANGE], [m.blau, m.orange]);
    assert.deepEqual([regie.snapshot().stand.blau, regie.snapshot().stand.orange], [m.blau, m.orange]);
  }
});

test("Rocket League: Simulator der Regie meldet 6 virtuelle PCs", () => {
  const cfg = { ...standardRegie(), aktivesSpiel: "rl" };
  const regie = new Regie({ getConfig: () => cfg, send: () => {} });
  const sim = new RegieSim({ regie });
  sim.start("runde", "rl");
  sim.stop();
  assert.equal(regie.snapshot().pcs.length, 6);
  assert.equal(sim.status().spiel, "rl");
  sim.start("runde", "cs2");
  sim.stop();
  assert.equal(regie.snapshot().pcs.length, 10);
});

test("Rocket League: ini schaltet die Stats API ein", () => {
  const ini = rlIni({ webPort: 49124 });
  assert.match(ini, /^\[TAGame\.MatchStatsExporter_TA\]/);
  assert.deepEqual(leseRlIni(ini), { rate: 10, port: 49123, webPort: 49124 });
  assert.equal(leseRlIni("[TAGame.MatchStatsExporter_TA]\nPacketSendRate=0").rate, 0);
});
