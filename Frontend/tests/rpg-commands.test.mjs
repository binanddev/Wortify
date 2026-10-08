import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCommand,destinations} from '../src/themes/rpg/commands.js';
test('quest commands navigate only to known features in the current language',()=>{
 for(const [key,path] of Object.entries(destinations))assert.equal(parseCommand(' OPEN '+key+' ','de').path,'/de/'+path);
 assert.equal(parseCommand('cards','en').path,'/en/flashcard');
 for(const input of ['https://example.com','rm -rf /','open admin','cards;clear',''])assert.equal(parseCommand(input,'de').type,'error');
 assert.equal(parseCommand('help','de').type,'help');assert.equal(parseCommand('clear','de').type,'clear');
});

test('DOS navigation supports cd and flashcard aliases',()=>{assert.equal(parseCommand('cd flashcard','de').path,'/de/flashcard');assert.equal(parseCommand('open flashcard','en').path,'/en/flashcard');});
