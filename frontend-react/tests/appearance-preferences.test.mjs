import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAppearance } from '../src/appearance-preferences.js';

test('appearance clamps values, keeps glass visible at 100%, and clears another account color', () => {
  const values = new Map();
  const previous = globalThis.document;
  globalThis.document = {documentElement:{dataset:{},style:{setProperty:(key,value) => values.set(key,value)}}};
  try {
    applyAppearance({transparency:100,textColor:'#ab12cd',textWeight:900,textContrast:100});
    assert.equal(values.get('--glass-alpha'),'0.04');
    assert.equal(values.get('--text-weight'),'700');
    assert.match(values.get('--ink'),/#ab12cd/);
    applyAppearance({background:'night'});
    assert.equal(values.get('--glass-alpha'),'0.75');
    assert.match(values.get('--ink'),/#f0f5ff/);
    assert.equal(values.get('--text-weight'),'500');
  } finally {globalThis.document = previous;}
});
