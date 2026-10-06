import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {interfaceName,INTERFACES} from '../src/interface-themes.js';
import {updateAppearance,restoreAppearance} from '../src/appearance-profiles.js';
import {AMBIENT_TRACKS,ambientTrack} from '../src/ambient-recordings.js';
test('all five interfaces retain independent preferences and Studio is the default',()=>{
 assert.equal(interfaceName(undefined),'studio');assert.equal(interfaceName('invalid'),'studio');
 for(const mode of INTERFACES.filter(x=>x!=='glass')) {
 let p={interface:'studio',background:'mist',textSize:18};p=updateAppearance(p,{...p,interface:mode});p=updateAppearance(p,{...p,textSize:21});p=updateAppearance(p,{...p,interface:'glass'});p=updateAppearance(p,{...p,interface:mode});assert.equal(p.interface,mode);assert.equal(p.textSize,21);assert.equal(restoreAppearance(p,null,true).interface,mode);
 }
});
test('all 20 recording choices point to real bundled MP3 assets with source attribution',async()=>{
 assert.equal(AMBIENT_TRACKS.length,20);assert.equal(new Set(AMBIENT_TRACKS.map(t=>t.id)).size,20);
 for(const track of AMBIENT_TRACKS){assert.ok(track.sourceFile.endsWith('.mp3'));assert.ok((await stat(new URL('../public'+track.src,import.meta.url))).size>10000);}
 assert.equal(ambientTrack('invalid'),AMBIENT_TRACKS[0]);
});
