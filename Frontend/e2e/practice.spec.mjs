import { test, expect } from '@playwright/test';
test.setTimeout(120000);

async function login(page) {
  await page.goto('/login');
  await page.getByLabel(/^Username/).fill('e2e_practice');
  await page.getByLabel(/^Password/).fill('E2eOnly!Password48');
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect.poll(async () => (await (await page.request.get('/api/session/')).json()).user?.username).toBe('e2e_practice');
  await expect(page).toHaveURL(/\/(en|de)\/flashcard/);
}
async function nodes(page) {
  const response = await page.request.get('/api/en/practice-hub/nodes/?full=1');
  expect(response.ok()).toBeTruthy();
  return (await response.json()).nodes;
}
async function openExercise(page, title) {
  const node = (await nodes(page)).find(item => item.title === title);
  expect(node).toBeTruthy();
  await page.goto(`/en/practice/${node.id}`);
  await expect(page.getByRole('button', {name: 'Exercise settings', exact:true})).toBeVisible();
  expect(await page.locator('.practice-exercise-heading h1').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(32);
  return node;
}
function resultReceipt(page) {
  return page.waitForResponse(response => {
    if (!response.url().endsWith('/api/en/learning/sync/') || response.request().method() !== 'POST') return false;
    return response.request().postDataJSON().events?.some(event => event.kind === 'practice_result');
  });
}
async function savedResult(responsePromise) {
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.errors).toEqual([]);
  const token = response.request().postDataJSON().events.find(event => event.kind === 'practice_result').token;
  const receipt = body.accepted.find(item => item.token === token);
  expect(receipt).toBeTruthy();
  return receipt.result;
}
async function expectHistory(page, id, score, total) {
  await expect.poll(async () => {
    const data = await (await page.request.get('/api/en/profile/')).json();
    return data.history.find(row => row.node === id && row.score === score && row.total === total)?.node;
  }).toBe(id);
}

test('text import keeps hints on server; new templates exclude legacy judgment but existing lessons open', async ({page}) => {
  await login(page);
  const folder = (await nodes(page)).find(node => node.title === 'E2E Practice folder');
  await page.goto(`/en/create/new?parent=${folder.id}`);
  await page.getByRole('button', {name: 'Page tools', exact: true}).click();
  await page.getByRole('button', {name: 'Import file / choose template', exact: true}).click();
  const templateDialog = page.getByRole('dialog');
  await templateDialog.locator('summary').filter({hasText: 'Templates for'}).click();
  const choices = templateDialog.getByLabel('Sample exercise type');
  await expect(choices.locator('option[value="true_false_not_given"]')).toHaveCount(0);
  await expect(choices.locator('option[value="cloze_drag_drop"]')).toHaveText('Word bank gaps');
  await expect(choices.locator('option[value="inline_selection"]')).toHaveText('Choose words in sentences');
  await templateDialog.getByRole('button', {name: 'Close', exact: true}).click();
  await page.goto(`/en/practice/${folder.id}`);
  await page.getByRole('button', {name: 'Import exercises', exact: true}).click();
  const source = 'EXERCISE: E2E imported hint\nTYPE: multiple_choice\nSTYLE: dialogue_reply\nQUESTION: What would you like?\nOPTIONS: Tea | Yesterday | At home\nANSWER: Tea\nHINT: Think about a drink.\n> You can order it.\nDISTRACTOR_EXPLANATION: The other choices describe time or place.\nEXPLANATION: Tea is a drink.\n';
  await page.getByLabel(/^Text draft/).fill(source);
  await page.getByRole('button', {name: 'Check and preview', exact: true}).click();
  const preview = page.getByRole('dialog').filter({hasText: 'Preview draft'});
  await preview.getByRole('button', {name: 'Close', exact: true}).click();
  await page.getByRole('button', {name: 'Import 1 exercises', exact: true}).click();
  await expect.poll(async () => (await nodes(page)).some(node => node.title === 'E2E imported hint')).toBe(true);
  await page.reload();
  const imported = (await nodes(page)).find(node => node.title === 'E2E imported hint');
  expect(imported.payload.questions[0].presentation.hint).toBe('Think about a drink.\nYou can order it.');
  expect(imported.payload.questions[0].presentation.distractor_explanation).toBe('The other choices describe time or place.');
  await openExercise(page, 'E2E legacy judgment');
  await expect(page.getByRole('button', {name: 'True', exact: true})).toBeVisible();
});

test('grouped gaps lock correct answers, retry wrong ones, persist results and restore summary', async ({page}, testInfo) => {
  await login(page);
  const node = await openExercise(page, 'E2E grouped repeated words');
  const gaps = page.locator('[data-group-gap]');
  const bank = page.locator('[data-group-bank]');
  await expect(gaps).toHaveCount(2);
  await expect(bank.getByRole('button', {name: 'is', exact: true})).toHaveCount(2);
  await page.screenshot({path: testInfo.outputPath('grouped-desktop.png'), fullPage: true});
  await bank.getByRole('button', {name: 'is', exact: true}).first().click();
  await bank.getByRole('button', {name: 'was', exact: true}).click();
  await page.getByRole('button', {name: 'Check', exact: true}).click();
  await expect(page.getByText('Not quite. Try again.', {exact: true})).toBeVisible();
  await expect(gaps.nth(0)).toBeDisabled();
  await expect(gaps.nth(1)).toHaveAttribute('aria-invalid', 'true');
  await gaps.nth(1).click();
  await bank.getByRole('button', {name: 'is', exact: true}).click();
  await page.getByRole('button', {name: 'Check', exact: true}).click();
  await expect(page.getByText('Correct!', {exact: true})).toBeVisible();
  const receipt = resultReceipt(page);
  await page.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Session complete', exact: true})).toBeVisible();
  const result = await savedResult(receipt);
  expect(result.score).toBe(2); expect(result.total).toBe(2);
  expect(result.summary.first_correct).toBe(1); expect(result.summary.after_retry).toBe(1);
  await expectHistory(page, node.id, 2, 2);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Session complete', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Practice weak questions', exact: true}).click();
  await expect(page.locator('[data-group-gap]')).toHaveCount(1);
  await expect(page.locator('.grouped-gap-question')).toContainText('a doctor.');
});

test('self-check withholds feedback until submission and saves server-graded results', async ({page}) => {
  await login(page);
  const node = await openExercise(page, 'E2E self check');
  await expect(page.getByText('Try, get feedback and use hints when you need them.', {exact:true})).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Self-check', exact:true})).toHaveCount(0);
  await page.getByRole('button', {name:'Exercise settings', exact:true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Self-check', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name:'Close', exact:true}).click();
  await page.getByRole('button', {name: 'Yesterday', exact: true}).click();
  await expect(page.getByText('Not quite. Try again.', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Show answer', exact: true})).toHaveCount(0);
  await expect(page.getByText('Tea is a drink.', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Next', exact: true}).click();
  await page.getByRole('button', {name: 'In London', exact: true}).click();
  await expect(page.getByText('Correct!', {exact: true})).toHaveCount(0);
  const receipt = resultReceipt(page);
  await page.getByRole('button', {name: 'Submit answers', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Session complete', exact: true})).toBeVisible();
  const result = await savedResult(receipt);
  expect(result.summary.mode).toBe('self_check');
  expect(result.score).toBe(1); expect(result.total).toBe(2);
  await expectHistory(page, node.id, 1, 2);
});

test('mobile taps can place repeated tokens in simultaneous gaps without horizontal overflow', async ({browser}, testInfo) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  try {
    await login(page);
    await openExercise(page, 'E2E grouped repeated words');
    await expect(page.locator('[data-group-gap]')).toHaveCount(2);
    const bank = page.locator('[data-group-bank]');
    await page.screenshot({path: testInfo.outputPath('grouped-mobile.png'), fullPage: true});
    await bank.getByRole('button', {name: 'is', exact: true}).first().tap();
    await bank.getByRole('button', {name: 'is', exact: true}).tap();
    await page.getByRole('button', {name: 'Check', exact: true}).tap();
    await expect(page.getByText('Correct!', {exact: true})).toBeVisible();
    const box = await page.locator('.grouped-gap').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
  } finally { await context.close(); }
});
