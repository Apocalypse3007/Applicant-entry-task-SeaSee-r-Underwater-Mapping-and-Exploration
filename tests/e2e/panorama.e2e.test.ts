import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer, { type Browser, type Page } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..', '..')
const artifactsDir = path.resolve(workspaceRoot, 'test-artifacts', 'e2e')
const baseUrl = 'http://127.0.0.1:4173'
const isCi = process.env.CI === 'true'

let server: ViteDevServer
let browser: Browser
let page: Page

const waitForPanoramaLoaded = async () => {
  await page.waitForFunction(() => {
    const loadingNode = Array.from(document.querySelectorAll('.status')).find((node) =>
      node.textContent?.includes('Loading panorama...'),
    )

    return !loadingNode
  })
}

const ensureArtifactsDirectory = () => {
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true })
  }
}

describe.sequential('Panorama viewer end-to-end', () => {
  beforeAll(async () => {
    ensureArtifactsDirectory()

    server = await createServer({
      root: workspaceRoot,
      configFile: path.resolve(workspaceRoot, 'vite.config.ts'),
      logLevel: 'error',
      server: {
        host: '127.0.0.1',
        port: 4173,
        strictPort: true,
      },
    })

    await server.listen()

    browser = await puppeteer.launch({
      headless: true,
      args: isCi ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
      defaultViewport: {
        width: 1440,
        height: 900,
      },
    })

    page = await browser.newPage()
    page.setDefaultNavigationTimeout(60000)
  })

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.close()
  })

  it('opens panorama index 0 and captures a screenshot', async () => {
    await page.goto(`${baseUrl}/?p=0`, { waitUntil: 'networkidle2' })

    await page.waitForSelector('.viewer', { visible: true })
    await page.waitForSelector('.panorama-list button.active', { visible: true })
    await waitForPanoramaLoaded()

    const activeLabel = await page.$eval('.panorama-list button.active', (node) => node.textContent?.trim() ?? '')
    expect(activeLabel).toBe('Soissons Cathedral')

    await page.screenshot({
      path: path.join(artifactsDir, 'panorama-p0.png'),
      fullPage: true,
    })
  })

  it('opens panorama index 1 and captures a screenshot', async () => {
    await page.goto(`${baseUrl}/?p=1`, { waitUntil: 'networkidle2' })

    await page.waitForSelector('.viewer', { visible: true })
    await page.waitForSelector('.panorama-list button.active', { visible: true })
    await waitForPanoramaLoaded()

    const activeLabel = await page.$eval('.panorama-list button.active', (node) => node.textContent?.trim() ?? '')
    expect(activeLabel).toBe('Laon Cathedral')

    await page.screenshot({
      path: path.join(artifactsDir, 'panorama-p1.png'),
      fullPage: true,
    })
  })
})
