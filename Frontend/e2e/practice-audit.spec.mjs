import {test, expect} from '@playwright/test';
import {parsePracticeText} from '../src/features/practice/practice-text.js';

test.setTimeout(120000);
async function create(page, source, transform = node => node) {
  await page.goto('/login');
  await page.getByLabel(/^Username/).fill('e2e_practice');
  await page.getByLabel(/^Password/).fill('E2eOnly!Password48');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/(en|de)\/flashcard/);
  const library=await (await page.request.get('/api/en/practice-hub/nodes/')).json();
  const node=transform(parsePracticeText(source).nodes[0]);
  const created=await page.evaluate(async body=>{
    const csrf=decodeURIComponent(document.cookie.split('; ').find(item=>item.startsWith('csrftoken='))?.slice(10)||'');
    const response=await fetch('/api/en/practice-hub/nodes/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  },{...node,parent:library.nodes.find(item=>item.kind==='folder').id});
  expect(created.status,JSON.stringify(created.data)).toBe(201);
  await page.goto(`/en/practice/${created.data.node.id}`);
  await expect(page.getByRole('button',{name:'Exercise settings',exact:true})).toBeVisible();
  return created.data.node.id;
}
async function selfCheck(page) {
  await page.getByRole('button',{name:'Exercise settings',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Self-check',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
}
async function finish(page, label, score, total) {
  const receipt=page.waitForResponse(response=>response.url().endsWith('/api/en/learning/sync/') && response.request().method()==='POST' && response.request().postDataJSON().events?.some(event=>event.kind==='practice_result'));
  await page.getByRole('button',{name:label,exact:true}).click();
  const response=await receipt, data=await response.json();
  expect(data.errors).toEqual([]);
  const token=response.request().postDataJSON().events.find(event=>event.kind==='practice_result').token;
  const result=data.accepted.find(event=>event.token===token).result;
  expect([result.score,result.total]).toEqual([score,total]);
  await expect(page.getByRole('heading',{name:'Session complete',exact:true})).toBeVisible();
}

test('changed and restored wrong answers can be checked again; whitespace reveal still saves',async ({page})=>{
  const id=await create(page,'EXERCISE: Retry regression\nTYPE: short_answer\nSTYLE: sentence_rewrite\nQUESTION: Say hello.\nANSWER: hello');
  const answer=page.getByRole('textbox',{name:'Answer',exact:true});
  await answer.fill('hi');
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await answer.fill('goodbye');
  await answer.fill('hi');
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await expect.poll(()=>page.evaluate(id=>{
    const key=Object.keys(localStorage).find(key=>key.startsWith('wortify:practice-run:') && key.includes(`:hub-${id}:`));
    return key && JSON.parse(localStorage.getItem(key)).records['1']?.attempts;
  },id)).toBe(2);
  await answer.fill('   ');
  await page.getByRole('button',{name:'Show answer',exact:true}).click();
  await finish(page,'Continue',0,1);
});

test('matching self-check restores pairs without revealing correctness before submission',async ({page})=>{
  await create(page,'EXERCISE: Matching audit\nTYPE: matching\nSTYLE: tap_match\nQUESTION: cat\nANSWER: mèo\nQUESTION: dog\nANSWER: chó');
  await selfCheck(page);
  const columns=page.locator('.pair-column');
  await columns.first().getByRole('button').filter({hasText:'cat'}).click();
  await columns.last().getByRole('button').filter({hasText:'mèo'}).click();
  await columns.first().getByRole('button').filter({hasText:'dog'}).click();
  await columns.last().getByRole('button').filter({hasText:'chó'}).click();
  await page.reload();
  await expect(page.locator('.pair-assigned')).toHaveText(['mèo','chó']);
  await expect(page.locator('.pair-card.paired')).toHaveCount(0);
  await finish(page,'Submit answers',2,2);
});

test('categorization keeps correct cards locked while wrong cards can be corrected',async ({page})=>{
  await create(page,'EXERCISE: Categories audit\nTYPE: categorization\nSTYLE: drag_sort\nGROUPS: Fruit | Animals\nQUESTION: apple\nANSWER: Fruit\nQUESTION: cat\nANSWER: Animals');
  const work=page.locator('.sorting-work');
  for(const word of ['apple','cat']) {
    await work.getByRole('button',{name:word,exact:true}).click();
    await work.locator('.category-head').filter({hasText:'Fruit'}).click();
  }
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await expect(work.getByRole('button',{name:'apple',exact:true})).toBeDisabled();
  await work.getByRole('button',{name:'cat',exact:true}).click();
  await work.getByRole('button',{name:'cat',exact:true}).click();
  await work.locator('.category-head').filter({hasText:'Animals'}).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await finish(page,'Continue',2,2);
});

test('sentence ordering with distractors survives editing and reload and submits the selected token order',async ({page})=>{
  const id=await create(page,'EXERCISE: Ordering audit\nTYPE: sentence_building\nSTYLE: tap_build\nQUESTION: Arrange the sentence.\nWORDS: She | is | here.',node=>{
    node.payload.questions[0].presentation.tokens.push({id:'noise',text:'unused'});
    return node;
  });
  await page.getByRole('button',{name:'Edit content',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Exercise title',{exact:true}).fill('Ordering audit edited');
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const detail=await (await page.request.get(`/api/en/practice-hub/nodes/${id}/`)).json();
  expect(detail.node.payload.questions[0].presentation.tokens).toHaveLength(4);
  expect(detail.node.payload.questions[0].accepted_answers).toHaveLength(3);
  await page.goto(`/en/create/${id}/edit?return=learn`);
  await page.getByLabel('Exercise title',{exact:true}).fill('Ordering audit direct edit');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/en/practice/${id}$`));
  const edited=await (await page.request.get(`/api/en/practice-hub/nodes/${id}/`)).json();
  expect(edited.node.payload.questions[0].presentation.tokens).toHaveLength(4);
  await selfCheck(page);
  for(const word of ['She','is','here.']) {
    await page.locator('[data-sentence-bank]').getByRole('button').filter({hasText:word}).press('Enter');
  }
  await page.reload();
  await expect(page.locator('[data-sentence-token]')).toHaveText(['She','is','here.']);
  await finish(page,'Submit answers',1,1);
});

test('legacy multi-answer editing preserves its answer set and requires explicit checking',async ({page})=>{
  const id=await create(page,'EXERCISE: Multi audit\nTYPE: multiple_choice\nQUESTION: Choose the animals.\nOPTIONS: cat | dog | tree\nANSWER: cat',node=>{
    node.payload.kind='multi';
    delete node.payload.presentation.style;
    node.payload.questions[0].kind='multi';
    node.payload.questions[0].accepted_answers=['cat','dog'];
    return node;
  });
  await page.getByRole('button',{name:'Edit content',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Exercise title',{exact:true}).fill('Multi audit edited');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/en/practice/${id}`);
  const detail=await (await page.request.get(`/api/en/practice-hub/nodes/${id}/`)).json();
  expect(detail.node.payload.questions[0].accepted_answers).toEqual(['cat','dog']);
  await page.getByRole('checkbox').filter({hasText:'cat'}).click();
  await page.getByRole('checkbox').filter({hasText:'dog'}).click();
  await expect(page.getByText('Correct!',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await expect(page.getByText('Correct!',{exact:true})).toBeVisible();
  await finish(page,'Continue',1,1);
});

test('inline selections keep per-gap options and submit through self-check',async ({page})=>{
  await create(page,'EXERCISE: Inline audit\nTYPE: inline_selection\nSTYLE: inline_select\nQUESTION: She {{1}} a doctor.\nBLANK: is => is | are | was');
  await selfCheck(page);
  await page.getByRole('button',{name:'Gap 1',exact:true}).click();
  await page.getByRole('group',{name:'Select a word',exact:true}).getByRole('button',{name:'is',exact:true}).click();
  await expect(page.getByText('Correct!',{exact:true})).toHaveCount(0);
  await finish(page,'Submit answers',1,1);
});
