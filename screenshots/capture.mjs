import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://localhost:8443'

mkdirSync(__dirname, { recursive: true })

const publicPages = [
  { path: '/login', name: '01-login' },
  { path: '/signup', name: '02-signup' },
  { path: '/forgot-password', name: '03-forgot-password' },
]

const authedPages = [
  { path: '/home', name: '04-home' },
  { path: '/leaderboard', name: '05-leaderboard' },
  { path: '/friends', name: '06-friends' },
  { path: '/profile', name: '07-profile' },
  { path: '/gamelobby', name: '08-gamelobby' },
  { path: '/gamelobby/table', name: '09-gamelobby-table' },
  { path: '/game', name: '10-game' },
]

const browser = await chromium.launch({ ignoreHTTPSErrors: true })
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

for (const { path: p, name } of publicPages) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true })
  console.log(`captured ${p}`)
}

// Login as Alice
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('input[autocomplete="username"]').fill('Alice')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.locator('button[type="submit"]').click()
await page.waitForTimeout(1500)
console.log('post-login url:', page.url())

for (const { path: p, name } of authedPages) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true })
  console.log(`captured ${p} -> ${page.url()}`)
}

await browser.close()
console.log('done')
