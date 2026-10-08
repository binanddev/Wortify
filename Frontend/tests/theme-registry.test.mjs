import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERFACES, interfaceName } from '../src/themes/registry.js';
import { restoreAppearance, updateAppearance } from '../src/themes/preferences.js';
test('retired Space selections restore safely and new themes keep independent settings', () => {
 assert.equal(interfaceName('space'), 'studio');
 assert.equal(restoreAppearance({interface:'space'}, null).interface, 'studio');
 assert.ok(INTERFACES.includes('notebook') && INTERFACES.includes('rpg'));
 const notebook = {interface:'notebook',background:'mist',textSize:20};
 const rpg = updateAppearance(notebook,{...notebook,interface:'rpg'},null);
 assert.equal(rpg.textSize,18);
 const restored = updateAppearance(rpg,{...rpg,interface:'notebook'},null);
 assert.equal(restored.textSize,20);
});
