import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import postcss from 'postcss';
test('NES.css and RPGUI rules are isolated to Retro and contain no remote imports',async()=>{
 const css=await fs.readFile(new URL('../src/vendor/retro-libraries.css',import.meta.url),'utf8');
 const ast=postcss.parse(css);
 ast.walkRules(rule=>{for(const selector of rule.selectors)assert.ok(selector.startsWith(':root[data-interface="retro"]'),selector)});
 ast.walkAtRules('import',()=>assert.fail('Vendor fonts must not load from remote services'));
 assert.match(css,/nes-icon/);assert.match(css,/rpgui-container/);assert.match(css,/--retro-cursor-point/);
 assert.doesNotMatch(css,/url\(["']?https?:/);
});
