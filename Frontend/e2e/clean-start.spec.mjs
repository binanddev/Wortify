import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// This suite runs alone against a migrated database with no fixtures or users.
async function post(page, url, data) {
  return page.evaluate(async ({ url, data }) => {
    const csrf = decodeURIComponent(document.cookie.split('; ').find(value => value.startsWith('csrftoken='))?.slice(10) || '');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, { url, data });
}

test('empty installation bootstraps, publishes one language and retains a new learner’s progress', async ({ page, browser }, testInfo) => {
  await page.goto('/');
  const catalog = async (client, lang) => (await (await client.get(`/api/${lang}/flashcard/discover/`)).json()).results;
  expect(await catalog(page.request, 'en')).toEqual([]);
  expect(await catalog(page.request, 'de')).toEqual([]);

  await page.goto('/en/reading/discover');
  await expect(page.getByText('No public readings in this language yet.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search readings', exact: true }).fill('unpublished');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No readings match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).last().click();
  await expect(page.getByText('No public readings in this language yet.', { exact: true })).toBeVisible();

  await page.goto('/setup-7f3c91d8/isolated-e2e-setup-key-not-for-production-2026/');
  await page.getByLabel(/^Username/).fill('clean_admin');
  await page.getByLabel(/^Password/).fill('CleanStart!Pass294');
  await page.getByLabel(/^Confirm password/).fill('CleanStart!Pass294');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect.poll(async () => (await (await page.request.get('/api/session/')).json()).user?.superuser).toBe(true);

  const document = {
    format: 'wortify-content', version: 1, id: randomUUID(), title: 'First lessons', language: 'en', mode: 'append',
    flashcards: [{ kind: 'deck', title: 'Everyday travel', level: 'A1', topic: 'Travel', cards: [
      { german_text: 'train', vietnamese_meaning: 'tàu hỏa' },
      { german_text: 'ticket', vietnamese_meaning: 'vé' },
    ] }],
  };
  const url = '/api/manage/content-packages/?section=flashcards&language=en';
  const text = JSON.stringify(document);
  const preview = await post(page, url, { text, preview: true });
  expect(preview.status, JSON.stringify(preview.body)).toBe(200);
  expect(await catalog(page.request, 'en')).toEqual([]);
  const options = { text, confirm: 'IMPORT', preview_token: preview.body.preview_token };
  const published = await post(page, url, options);
  expect(published.status, JSON.stringify(published.body)).toBe(201);
  expect((await post(page, url, options)).body.already_imported).toBe(true);

  const context = await browser.newContext();
  const learner = await context.newPage();
  try {
    await learner.goto('/en/flashcard/discover');
    const publicDecks = await catalog(learner.request, 'en');
    expect(publicDecks).toHaveLength(1);
    expect(publicDecks[0].title).toBe('Everyday travel');
    expect(await catalog(learner.request, 'de')).toEqual([]);
    await learner.goto('/register');
    await learner.getByLabel(/^Username/).fill('clean_learner');
    await learner.getByLabel(/^Password/).fill('Learner!Pass294');
    await learner.getByLabel(/^Confirm password/).fill('Learner!Pass294');
    await learner.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect.poll(async () => (await (await learner.request.get('/api/session/')).json()).user?.username).toBe('clean_learner');
    const emptyProfile = await (await learner.request.get('/api/en/profile/')).json();
    expect(emptyProfile.today_questions).toBe(0);
    expect(emptyProfile.decks).toEqual([]);
    await learner.goto('/en/profile');
    await expect(learner.locator('a.profile-continue')).toHaveAttribute('href', '/en/flashcard/discover');
    await expect(learner.getByText('No flashcards in your library yet.', { exact: true })).toBeVisible();
    await learner.screenshot({ path: testInfo.outputPath('empty-profile.png'), fullPage: true });
    const copied = await post(learner, `/api/en/flashcard/discover/${publicDecks[0].id}/copy/`, {});
    expect(copied.status, JSON.stringify(copied.body)).toBe(201);
    const id = copied.body.id;
    expect(id).not.toBe(publicDecks[0].id);
    await learner.goto(`/en/flashcard/deck/${id}`);
    await learner.getByRole('button', { name: 'Star', exact: true }).click();
    await learner.getByRole('button', { name: 'Check and show answer', exact: true }).click();
    const detail = async () => (await (await learner.request.get(`/api/en/decks/${id}/`)).json());
    await expect.poll(async () => Object.keys((await detail()).learning.progress).length).toBeGreaterThan(0);
    await expect.poll(async () => (await detail()).learning.stars.length).toBe(1);
    await learner.reload();
    await expect(learner.getByRole('button', { name: 'Unstar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect((await detail()).cards).toHaveLength(2);
    expect((await (await learner.request.get('/api/de/profile/')).json()).today_questions).toBe(0);
  } finally {
    await context.close();
  }
});
