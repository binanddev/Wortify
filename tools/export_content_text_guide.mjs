import {writeFile} from 'node:fs/promises';
import {contentTextGuide,contentTextExample} from '../Frontend/src/features/admin/content-text-guide.js';
for(const root of ['Frontend/public/templates/','Backend/sample_data/']) {
 await writeFile(new URL('../'+root+'content-package.txt',import.meta.url),contentTextExample);
 await writeFile(new URL('../'+root+'content-authoring.txt',import.meta.url),contentTextGuide());
}
console.log('Content text example and shared guide exported.');
