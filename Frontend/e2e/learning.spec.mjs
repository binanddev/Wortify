import { test, expect } from '@playwright/test';
const password = 'E2eOnly!Password48';
async function login(page, username = 'e2e_learner') {
  await page.goto('/login');
  await page.getByLabel(/^Username/).fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect.poll(async () => {
    try { return (await (await page.request.get('/api/session/')).json()).user?.username; }
    catch { return null; }
  }).toBe(username);
}
async function deck(page) {
  const result = await page.request.get('/api/en/decks/');
  expect(result.ok()).toBeTruthy();
  return (await result.json()).decks[0].id;
}
async function detail(page, id) {
  const response = await page.request.get(`/api/en/decks/${id}/`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('sign in, study and reload preserve server progress; a second account cannot access it', async ({ page }) => {
  await login(page);
  const id = await deck(page);
  await page.goto(`/en/flashcard/deck/${id}`);
  await expect(page.getByRole('button', { name: /^(Star|Unstar)$/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Star', exact: true }).count())
    await page.getByRole('button', { name: 'Star', exact: true }).click();
  await page.getByRole('button', { name: 'Check and show answer', exact: true }).click();
  await expect.poll(async () => (await detail(page, id)).learning.stars.length).toBe(1);
  await expect.poll(async () => Object.keys((await detail(page, id)).learning.progress).length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unstar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Same browser storage, a different authenticated account: private deck stays inaccessible.
  await page.context().clearCookies();
  await login(page, 'e2e_other');
  expect((await page.request.get(`/api/en/decks/${id}/`)).status()).toBe(404);
  await page.goto(`/en/flashcard/deck/${await deck(page)}`);
  await expect(page.getByRole('button', { name: 'Star', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('card import previews before writing, persists after confirmation and reload', async ({ page }) => {
  await login(page);
  const id = await deck(page);
  const before = (await detail(page, id)).cards.length;
  await page.goto('/en/flashcard/library');
  await page.getByRole('button', { name: 'Deck actions: e2e_learner private vocabulary', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Manage cards', exact: true }).click();
  const secondPage = page.waitForResponse(response => response.url().includes('cards_page=2') && response.status() === 200);
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  expect((await (await secondPage).json()).cards.length).toBeLessThanOrEqual(50);
  await expect(page.getByRole('dialog').getByText('fixture term 54', { exact: true })).toBeVisible();
  const searched = page.waitForResponse(response => decodeURIComponent(response.url()).includes('q=fixture term 54') && response.status() === 200);
  await page.getByRole('dialog').getByLabel('Search cards').fill('fixture term 54');
  expect((await (await searched).json()).cards.map(card => card.german_text)).toEqual(['fixture term 54']);
  await expect(page.getByRole('dialog').getByText('fixture term 54', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('Paste cards from AI, Quizlet or your spreadsheet').fill('bicycle|xe đạp');
  await page.getByRole('button', { name: 'Preview cards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import cards', exact: true })).toBeVisible();
  expect((await detail(page, id)).cards.length).toBe(before);
  await page.getByRole('button', { name: 'Import cards', exact: true }).click();
  await expect.poll(async () => (await detail(page, id)).cards.length).toBe(before + 1);
  await page.reload();
  expect((await detail(page, id)).cards.some(card => card.german_text === 'bicycle')).toBeTruthy();
});

test('anonymous public lesson is viewable and revocation takes effect', async ({ browser, page }) => {
  const owner = await browser.newPage();
  try {
    await login(owner);
    const rooms = await (await owner.request.get('/api/en/classes/')).json();
    const room = rooms.classes[0];
    const sharing = enabled => owner.evaluate(async ({ id, enabled }) => {
      const csrf = decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('csrftoken='))?.slice(10) || '');
      const response = await fetch(`/api/en/classes/${id}/boards/11111111-1111-4111-8111-111111111111/sharing/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw Error(`Sharing failed: ${response.status}`);
      return response.json();
    }, { id: room.id, enabled });
    const shared = await sharing(true);
    await page.goto(shared.path);
    await expect(page.getByRole('heading', { name: 'E2E public lesson', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open public lesson', exact: true })).toBeVisible();
    expect((await page.request.get('/api/en/classes/')).status()).toBe(401);
    await sharing(false);
    await page.reload();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open public lesson', exact: true })).toHaveCount(0);
  } finally { await owner.close(); }
});

test('IndexedDB recovers unsent progress after reload when localStorage quota is exhausted', async ({ page }) => {
  await login(page, 'e2e_offline');
  const id = await deck(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('wortify:sync:')) throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto(`/en/flashcard/deck/${id}`);
  await expect(page.getByRole('button', { name: /^(Star|Unstar)$/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Unstar', exact: true }).count()) {
    await page.getByRole('button', { name: 'Unstar', exact: true }).click();
    await expect.poll(async () => (await detail(page, id)).learning.stars.length).toBe(0);
  }
  await page.route('**/api/en/learning/sync/', route => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  // Wait for the durable transaction, not an arbitrary sleep, before discarding RAM.
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('wortify-learning-queue', 1);
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('queues').objectStore('queues').getAll();
      request.onsuccess = () => { resolve(request.result.some(snapshot => snapshot.value?.some(event => event.kind === 'star'))); db.close(); };
      request.onerror = () => { resolve(false); db.close(); };
    };
  }))).toBe(true);
  expect((await detail(page, id)).learning.stars.length).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unstar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.unroute('**/api/en/learning/sync/');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => (await detail(page, id)).learning.stars.length, { timeout: 30000 }).toBe(1);
});
