const config = require('config')
const withPage = require('./lib/withPage')
const log = require('./lib/log')('get-session-id')

module.exports = withPage(checkForSlots)

async function checkForSlots (page) {
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.0 Safari/537.36'
  )

  log.info('Opening up touchpoint')
  await page.goto('https://eclipsetouchpoint.co.uk/StrategaLaw')

  if (await exists('#cookieContinueBtn')) {
    log.info('Accepting cookies')
    await page.click('#cookieContinueBtn')
  }

  await page.waitFor('#loginLink', { visible: true })
  await page.waitFor(1000)
  await page.click('#loginLink')

  log.info('Entering creds and signing in')
  await page.waitFor(1000)
  await page.type('#UserName', config.fileview.username)
  await page.type('#Password', config.fileview.password)
  await page.click('#securityButton')
  await page.waitFor('#closeWelcomeMessageBox', {
    visible: true
  })
  await page.click('#closeWelcomeMessageBox')

  log.info('Going to fileview')
  await page.waitFor(1000)
  await page.waitFor('#Anchor-10048', {
    visible: true
  })
  await page.click('#Anchor-10048')

  log.info('Extracting session ID')
  await page.waitForNavigation()
  await page.waitFor('#case', {
    visible: true
  })

  const sessionId = await page.evaluate(() => window.sessionparam.csessionid)
  log.info(`Found session ID: ${sessionId}`)

  return sessionId

  function count (sel) {
    return page.$$eval(sel, els => els.length)
  }

  async function exists (sel) {
    return (await count(sel)) > 0
  }
}
