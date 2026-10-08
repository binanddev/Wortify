import fs from 'node:fs/promises';
import postcss from 'postcss';
const root = new URL('../', import.meta.url);
const ast = postcss.parse(await fs.readFile(new URL('node_modules/terminal.css/dist/terminal.css', root), 'utf8'));
const scope = ':root[data-interface="rpg"] .quest-console';
ast.walkAtRules(/keyframes$/, rule => { rule.params = 'rpg-terminal-' + rule.params; });
ast.walkDecls(/animation/, decl => { decl.value = decl.value.replace(/\bcursor\b/g, 'rpg-terminal-cursor'); });
ast.walkRules(rule => {
 if(rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
 rule.selectors = rule.selectors.map(s => s === ':root' || s === 'body' || s === '.terminal' ? scope : scope + ' ' + s.replace(/^\.terminal\s+/, ''));
});
await fs.writeFile(new URL('src/vendor/terminal-scoped.css',root), '/* Terminal.css (MIT), scoped to RPG command console. Regenerate with build-terminal-vendor.mjs. */\n'+ast.toString());
await fs.copyFile(new URL('node_modules/terminal.css/LICENSE',root),new URL('src/vendor/LICENSE-terminal-css',root));
