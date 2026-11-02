import {test, expect} from '@playwright/test';
async function login(page, username) {
  await page.goto('/login');
  await page.getByLabel(/^Username/).fill(username);
  await page.getByLabel(/^Password/).fill('E2eOnly!Password48');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect.poll(async () => (await (await page.request.get('/api/session/')).json()).user?.username).toBe(username);
}
test('learner proposes a text answer and only explicit owner review changes the answer key', async ({page, browser}) => {
  test.setTimeout(120000);
  await login(page,'e2e_practice');
  const library = await (await page.request.get('/api/en/practice-hub/nodes/')).json();
  const parent = library.nodes.find(node=>node.kind==='folder').id;
  const created = await page.evaluate(async parent => {
    const csrf=decodeURIComponent(document.cookie.split('; ').find(item=>item.startsWith('csrftoken='))?.slice(10)||'');
    const response=await fetch('/api/en/practice-hub/nodes/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({kind:'exercise',parent,visibility:'public',title:'Answer review regression',payload:{presentation:{interaction:'short_answer',style:'sentence_rewrite'},questions:[{prompt:'Say hello.',accepted_answers:['hello']}]}})});
    return {status:response.status,data:await response.json()};
  },parent);
  expect(created.status,JSON.stringify(created.data)).toBe(201);
  const id=created.data.node.id;
  const context=await browser.newContext();
  const learner=await context.newPage();
  try {
    await login(learner,'e2e_learner');
    await learner.goto(`/en/practice/${id}`);
    await learner.getByRole('textbox',{name:'Answer',exact:true}).fill('hi');
    await learner.getByRole('button',{name:'Check',exact:true}).click();
    await learner.getByRole('button',{name:'Suggest another answer',exact:true}).click();
    const dialog=learner.getByRole('dialog');
    await expect(dialog.getByLabel(/^Proposed answer/)).toHaveValue('hi');
    await dialog.getByRole('button',{name:'Send suggestion',exact:true}).click();
    await expect(dialog.getByText('Suggestion sent for review. Your score and accepted answers have not changed.',{exact:true})).toBeVisible();
    const detail=async ()=>(await (await page.request.get(`/api/en/practice-hub/nodes/${id}/`)).json()).node;
    expect((await detail()).payload.questions[0].accepted_answers).toEqual(['hello']);
    await page.goto(`/en/practice/${id}`);
    await page.getByRole('button',{name:'Review answer suggestions',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Approve and add answer',exact:true}).click();
    await expect.poll(async ()=>(await detail()).payload.questions[0].accepted_answers).toEqual(['hello','hi']);
    await learner.reload();
    await learner.getByRole('textbox',{name:'Answer',exact:true}).fill('hi');
    await learner.getByRole('button',{name:'Check',exact:true}).click();
    await expect(learner.getByText('Correct!',{exact:true})).toBeVisible();
  } finally {await context.close();}
});
