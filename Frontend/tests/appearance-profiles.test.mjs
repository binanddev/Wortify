import test from "node:test";
import assert from "node:assert/strict";
import {
  updateAppearance,
  restoreAppearance,
} from "../src/appearance-profiles.js";
test("appearance profiles isolate interfaces, backgrounds and saved themes", () => {
  let p = {
    interface: "studio",
    background: "mist",
    textColor: "#ffffff",
    textSize: 22,
    navScale: 75,
    sound: true,
  };
  p = updateAppearance(p, { ...p, interface: "glass" }, 4);
  p = updateAppearance(
    p,
    { ...p, textColor: "#000000", textSize: 16, navScale: 150 },
    4,
  );
  p = updateAppearance(p, { ...p, interface: "studio" }, 4);
  assert.equal(p.textColor, "#ffffff");
  assert.equal(p.textSize, 22);
  assert.equal(p.navScale, 75);
  assert.equal(p.sound, true);
  p = updateAppearance(p, { ...p, background: "night" }, 4);
  assert.equal(p.textColor, "auto");
  p = updateAppearance(p, { ...p, background: "mist" }, 4);
  assert.equal(p.textColor, "#ffffff");
  assert.equal(
    restoreAppearance({ ...p, interface: "glass" }, 4).textColor,
    "#000000",
  );
  assert.equal(
    restoreAppearance({ ...p, textColor: "auto" }, 5).textColor,
    "auto",
  );
});

test('login restores the selected mode even when the saved theme supplies another mode', () => {
  const p = updateAppearance({interface:'studio',background:'mist',textColor:'#ffffff'}, {interface:'glass',background:'night'}, 8);
  const restored = restoreAppearance({...p,interface:'studio',background:'mist'},8,true);
  assert.equal(restored.interface,'glass');
  assert.equal(restored.background,'night');
});
