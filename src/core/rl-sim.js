"use strict";
// Simuliert ein Rocket-League-Match (3 gegen 3): erzeugt Nachrichten der Stats API ({ Event, Data }),
// wie sie jeder PC im Match bekommt. Sie laufen durch dieselbe Pipeline wie echte Daten.

const { zufall } = require("./gsi-sim");

const NAMEN = [["Momo", "Kira", "Jax"], ["Rex", "Vex", "Zed"]];
const DAUER = 300; // Sekunden Spielzeit

class RlSimMatch {
  constructor({ seed = Date.now() } = {}) {
    this.rnd = zufall(seed);
    this.guid = `SIM-${(seed >>> 0).toString(16).toUpperCase()}`; // wie die MatchGuid echter Matches
    this.score = [0, 0];
    this.zeit = DAUER;
    this.overtime = false;
    this.gestartet = false;
    this.ende = false;
    this.runde = 0; // Anstöße
    this.spieler = NAMEN.flatMap((team, t) => team.map((Name, i) => ({ Name, Shortcut: t * 3 + i + 1, TeamNum: t, Goals: 0, Shots: 0, Saves: 0, Assists: 0, Score: 0 })));
  }

  vorbei() { return this.ende; }
  get blau() { return this.score[0]; }
  get orange() { return this.score[1]; }

  ziehe(liste) { return liste[Math.floor(this.rnd() * liste.length)]; }
  team(t) { return this.spieler.filter((p) => p.TeamNum === t); }
  ziel(p) { return { Name: p.Name, Shortcut: p.Shortcut, TeamNum: p.TeamNum }; }
  feed(EventName, haupt, zweit) { return { Event: "StatfeedEvent", Data: { EventName, Type: EventName, MainTarget: this.ziel(haupt), ...(zweit ? { SecondaryTarget: this.ziel(zweit) } : {}) } }; }
  zustand() {
    return { Event: "UpdateState", Data: {
      MatchGuid: this.guid, Players: this.spieler.map((p) => ({ ...p })),
      Game: { Teams: [{ Name: "Blue", TeamNum: 0, Score: this.score[0] }, { Name: "Orange", TeamNum: 1, Score: this.score[1] }], TimeSeconds: Math.max(0, this.zeit), bOvertime: this.overtime, Arena: "DFH Stadium" },
    } };
  }

  // Ein Abschnitt vom Anstoß bis zum Tor. Schritte: { dt, payloads }
  naechsteRunde() {
    const s = [];
    const schritt = (dt, ...payloads) => s.push({ dt, payloads });
    if (!this.gestartet) { this.gestartet = true; schritt(600, { Event: "MatchCreated", Data: {} }, { Event: "MatchInitialized", Data: {} }, this.zustand()); }
    this.runde++;
    schritt(1200, { Event: "RoundStarted", Data: {} }, this.zustand());
    // Spielzüge bis zum Tor
    const zuege = 2 + Math.floor(this.rnd() * 4);
    for (let i = 0; i < zuege; i++) {
      this.zeit -= this.overtime ? 0 : 8 + Math.floor(this.rnd() * 20);
      if (this.overtime) this.zeit += 10;
      const t = this.rnd() < 0.5 ? 0 : 1, a = this.ziehe(this.team(t)), b = this.ziehe(this.team(1 - t));
      const r = this.rnd();
      if (r < 0.4) { a.Shots++; b.Saves++; schritt(1300, this.feed("Shot", a), this.feed(this.rnd() < 0.25 ? "EpicSave" : "Save", b), this.zustand()); }
      else if (r < 0.7) schritt(1300, this.feed("Demolish", a, b), this.zustand());
      else if (r < 0.85) schritt(1300, { Event: "CrossbarHit", Data: { BallLastTouch: { Player: this.ziel(a) } } }, this.zustand());
      else schritt(1300, { Event: "BallHit", Data: {} }, this.zustand());
    }
    // Tor
    const t = this.rnd() < 0.5 ? 0 : 1, wer = this.ziehe(this.team(t));
    const vorlage = this.rnd() < 0.6 ? this.ziehe(this.team(t).filter((p) => p !== wer)) : null;
    this.score[t]++; wer.Goals++; wer.Shots++;
    if (vorlage) vorlage.Assists++;
    const goal = [this.feed("Shot", wer), { Event: "GoalScored", Data: { Scorer: this.ziel(wer), ...(vorlage ? { Assister: this.ziel(vorlage) } : {}), GoalSpeed: 60 + Math.round(this.rnd() * 60) } }, this.feed("Goal", wer)];
    if (vorlage) goal.push(this.feed("Assist", vorlage));
    if (wer.Goals === 3) goal.push(this.feed("HatTrick", wer));
    goal.push(this.zustand());
    schritt(1400, ...goal);
    schritt(900, { Event: "GoalReplayStart", Data: {} });
    // Spielende: Zeit abgelaufen und kein Gleichstand, oder Tor in der Verlängerung
    if (this.overtime || (this.zeit <= 0 && this.score[0] !== this.score[1])) {
      this.ende = true;
      const sieger = this.score[0] > this.score[1] ? 0 : 1;
      const mvp = this.team(sieger).sort((a, b) => b.Goals - a.Goals)[0];
      schritt(2500, { Event: "GoalReplayEnd", Data: {} }, { Event: "MatchEnded", Data: { WinnerTeamNum: sieger } }, this.feed("MVP", mvp));
      schritt(1500, { Event: "PodiumStart", Data: {} });
      return s;
    }
    schritt(2500, { Event: "GoalReplayEnd", Data: {} });
    if (this.zeit <= 0 && !this.overtime) { this.overtime = true; this.zeit = 0; schritt(800, this.zustand()); }
    return s;
  }
}

module.exports = { RlSimMatch };
