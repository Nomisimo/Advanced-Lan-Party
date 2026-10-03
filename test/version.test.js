const test = require("node:test");
const assert = require("node:assert/strict");
const { CHANGELOG, compareVersions, neuesteVersion, macDmg } = require("../src/core/version");
const pkg = require("../package.json");

test("Versionen vergleichen, Betas vor der fertigen Version", () => {
  assert.ok(compareVersions("0.1.0-beta.4", "0.1.0-beta.3") > 0);
  assert.ok(compareVersions("0.1.0-beta.10", "0.1.0-beta.9") > 0);
  assert.ok(compareVersions("0.1.0", "0.1.0-beta.9") > 0);
  assert.equal(compareVersions("v0.1.0-beta.3", "0.1.0-beta.3"), 0);
});

test("Neueste Version und passendes Mac-DMG aus der Release-Liste", () => {
  const list = [
    { tag_name: "v0.1.0-beta.3", assets: [{ name: "Advanced.LAN-0.1.0-beta.3-mac-x64.dmg", url: "https://github.com/Nomisimo/Advanced-Lan-Party/releases/download/v0.1.0-beta.3/Advanced.LAN-0.1.0-beta.3-mac-x64.dmg" }] },
    { tag_name: "v0.1.0-beta.5", draft: true },
    { tag_name: "v0.1.0-beta.1", assets: [] },
  ];
  const n = neuesteVersion(list);
  assert.equal(n.tag_name, "v0.1.0-beta.3");
  assert.match(macDmg(n).url, /-mac-x64\.dmg$/);
  assert.equal(macDmg(list[2]), null);
});

test("„Was ist neu?“ kennt die Version aus package.json", () => {
  assert.ok(CHANGELOG[pkg.version], `Changelog-Eintrag für ${pkg.version} fehlt`);
});
