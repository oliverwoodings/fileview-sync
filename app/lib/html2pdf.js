const convert = require('pdf-puppeteer')
const config = require('config')

module.exports = async function html2pdf (html) {
  return new Promise(resolve => {
    convert(html, resolve, null, config.puppeteer.options)
  })
}
