import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/i18n/messages.json' with {type:'json'};
import { t, setLanguage, getLanguage } from '../src/i18n/index.js';
test('handwritten catalog has Vietnamese and German for every interface key', () => {
  assert.ok(Object.keys(catalog).length > 1100);
  for(const [key,row] of Object.entries(catalog)) {
    assert.ok(row.vi?.trim(),key+' vi');assert.ok(row.de?.trim(),key+' de');
    const params=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(params(row.vi),params(key),key+' vi parameters');
    assert.deepEqual(params(row.de),params(key),key+' de parameters');
  }
});
test('language is explicit, preserves spaces and interpolates data without translating it', () => {
  setLanguage('vi');assert.equal(t('Save'),'Lưu');assert.equal(t(' terms'),' từ');
  assert.equal(t('Use “{v0}” in a new sentence',{v0:'Save'}),'Dùng “Save” trong câu mới');
  setLanguage('de');assert.equal(t('Save'),'Speichern');
  setLanguage('invalid');assert.equal(getLanguage(),'de');
  assert.equal(t('Unmapped content'),'Unmapped content');
  setLanguage('en');assert.equal(t(' Save '),' Save ');
});
