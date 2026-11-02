import {test, expect} from '@playwright/test';

test('self-check preserves corrected sentences on previous navigation and reload', async ({page}) => {
  await page.goto('/login');
  await page.getByLabel(/^Username/).fill('e2e_practice');
  await page.getByLabel(/^Password/).fill('E2eOnly!Password48');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
  await expect.poll(async () => (await (await page.request.get('/api/session/')).json()).user?.username).toBe('e2e_practice');
  await expect(page).toHaveURL(/\/(en|de)\/flashcard/);
  const library = await (await page.request.get('/api/en/practice-hub/nodes/')).json();
  const parent = library.nodes.find(node => node.kind === 'folder').id;
  const created = await page.evaluate(async parent => {
    const csrf = decodeURIComponent(document.cookie.split('; ').find(item=>item.startsWith('csrftoken='))?.slice(10) || '');
    const response = await fetch('/api/en/practice-hub/nodes/', {
      method:'POST', headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
      body:JSON.stringify({kind:'exercise',parent,title:'Correction restore regression',payload:{
        title:'Correction restore regression',kind:'text',presentation:{interaction:'error_correction',style:'click_edit'},
        questions:[
          {prompt:'She go home.',accepted_answers:['She goes home.']},
          {prompt:'They is here.',accepted_answers:['They are here.']},
        ],
      }}),
    });
    return {status:response.status,data:await response.json()};
  }, parent);
  expect(created.status,JSON.stringify(created.data)).toBe(201);
  await page.goto(`/en/practice/${created.data.node.id}`);
  await page.getByRole('button',{name:'Exercise settings',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Self-check',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('.clickable-passage').getByRole('button',{name:'go',exact:true}).click();
  await page.getByLabel('Replacement word',{exact:true}).fill('goes');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(page.locator('.corrected-preview')).toContainText('She goes home.');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  const answer=page.getByRole('textbox',{name:'Answer',exact:true});
  await expect(answer).toHaveValue('She goes home.');
  await expect(page.locator('.correction-work .work-prompt')).toHaveText('She go home.');
  await answer.fill('She goes home now.');
  await page.reload();
  await expect(answer).toHaveValue('She goes home now.');
  await expect(page.getByText('Correct!',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Show answer',exact:true})).toHaveCount(0);
  await answer.fill('She goes home.');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.locator('.clickable-passage').getByRole('button',{name:'is',exact:true}).click();
  await page.getByLabel('Replacement word',{exact:true}).fill('are');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  const receipt=page.waitForResponse(response=>response.url().endsWith('/api/en/learning/sync/') && response.request().method()==='POST' && response.request().postDataJSON().events?.some(event=>event.kind==='practice_result'));
  await page.getByRole('button',{name:'Submit answers',exact:true}).click();
  const response=await receipt;
  const result=await response.json();
  expect(result.errors).toEqual([]);
  const token=response.request().postDataJSON().events.find(event=>event.kind==='practice_result').token;
  expect(result.accepted.find(event=>event.token===token).result.score).toBe(2);
});
