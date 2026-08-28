import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://localhost:8443'

const browser = await chromium.launch({ ignoreHTTPSErrors: true })

async function login(identifier, password) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.locator('input[autocomplete="username"]').fill(identifier)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login')),
    page.locator('button[type="submit"]').click(),
  ])
  if (!resp.ok()) throw new Error(`login failed for ${identifier}: ${resp.status()}`)
  await page.waitForURL(/\/home/, { timeout: 20000 })
  return page
}

async function clearActiveGames(page) {
  const mine = await page.evaluate(async () => {
    const res = await fetch('/api/games/mine', { credentials: 'include' })
    return res.ok ? res.json() : []
  })
  for (const g of mine) {
    await page.evaluate(async (id) => {
      await fetch(`/api/game/${id}/resign`, { method: 'POST', credentials: 'include' })
    }, g.id)
  }
  if (mine.length) console.log('cleared', mine.length, 'stray game(s)')
}

const alice = await login('Alice', 'password')
const bob = await login('Bob', 'password')
console.log('logged in Alice + Bob')

await clearActiveGames(alice)
await clearActiveGames(bob)

// Alice hosts a new pvp table
await alice.goto(`${BASE}/gamelobby`, { waitUntil: 'load' })
const hostBtn = alice.getByText('HOST NEW TABLE', { exact: true })
await hostBtn.waitFor({ state: 'visible', timeout: 15000 })
await hostBtn.click()
await alice.waitForURL(/\/game\?gameId=/, { timeout: 15000 })
const gameId = new URL(alice.url()).searchParams.get('gameId')
console.log('Alice hosted game', gameId)

// Bob finds Alice's room in the lobby list and joins it
await bob.goto(`${BASE}/gamelobby`, { waitUntil: 'load' })
const bobJoinBtn = bob.getByRole('button', { name: 'Join', exact: true }).first()
await bobJoinBtn.waitFor({ state: 'visible', timeout: 15000 })
await bobJoinBtn.click()
await bob.waitForURL(/\/game\?gameId=/, { timeout: 15000 })
console.log('Bob joined game', bob.url())

await alice.waitForTimeout(1500)

// Alice forfeits to end the match fast and reach the result screen
await alice.getByRole('button', { name: /ABORT MATCH/ }).first().click()
await alice.getByRole('button', { name: /CONFIRM ABORT/ }).first().click()
await alice.waitForTimeout(1200)

await alice.screenshot({ path: path.join(__dirname, '11-pvp-result.png'), fullPage: true })
console.log('captured pvp result screenshot')

await browser.close()
console.log('done')
