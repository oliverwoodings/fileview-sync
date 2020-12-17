const config = require('config')
const { CronJob } = require('cron')
const log = require('./lib/log')
const sentry = require('./lib/sentry')
const syncFileview = require('./syncFileview')

let locked = false

log.info(`Running on schedule: ${config.schedule}`)
new CronJob(config.schedule, run, null, true, null, null, config.runOnStart)

async function run () {
  if (locked) {
    log.warn('Another run is still in progress, skipping')
    return
  }

  locked = true
  try {
    log.info('Syncing fileview')
    await syncFileview()
  } catch (e) {
    sentry.captureException(e)
    log.error(e)
  }
  locked = false
}
