import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../frontend/core/store.js';
import {createEvents} from '../frontend/core/events.js';
import {Router} from '../frontend/core/router.js';
import {scopedApi} from '../frontend/core/api.js';

test('store subscribes and releases only the owning listener', () => {
  const store = createStore({count: 0}); let calls = 0;
  const off = store.subscribe(state => { calls++; assert.equal(state.count, 1); });
  store.set({count: 1}); off(); store.set({count: 2});
  assert.equal(calls, 1); assert.equal(store.get().count, 2); assert(Object.isFrozen(store.get()));
});
test('events unsubscribe cleanly', () => {
  const events = createEvents(); let calls = 0; const off = events.on('answer', () => calls++);
  events.emit('answer'); off(); events.emit('answer'); assert.equal(calls, 1);
});
test('history routes destroy the old view and parse dynamic ids', () => {
  globalThis.location = new URL('http://localhost/flashcard/deck/42');
  globalThis.window = {scrollTo() {}};
  const calls = [];
  const router = new Router({replaceChildren() {}});
  router.register('/flashcard/deck/:id', params => ({mount() { calls.push(`mount:${params.id}`); }, destroy() { calls.push('destroy'); }}));
  router.render(); location.pathname = '/flashcard/deck/43'; router.render(); router.destroy();
  assert.deepEqual(calls, ['mount:42', 'destroy', 'mount:43', 'destroy']);
});
test('language clients keep independent endpoint prefixes', async () => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async path=>{calls.push(path);return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({})};};
  try {
    await scopedApi('/api/en').get('/decks/');
    await scopedApi('/api/de').get('/decks/');
    assert.deepEqual(calls,['/api/en/decks/','/api/de/decks/']);
  } finally {globalThis.fetch=originalFetch;}
});

test('answer button stays locked after successful grading and suppresses repeat clicks', async () => {
  const previous=globalThis.document;
  globalThis.document={createElement(){return {dataset:{},disabled:false,addEventListener(name,fn){this[name]=fn;},setAttribute(){},append(){}};}};
  try {
    const {button}=await import('../frontend/shared/Button.js');
    let calls=0;
    const node=button('Answer',async()=>{calls++;node.dataset.locked='true';});
    await node.click({currentTarget:node});
    await node.click({currentTarget:node});
    assert.equal(calls,1);assert.equal(node.disabled,true);
  } finally {globalThis.document=previous;}
});
