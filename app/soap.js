const axios = require('axios')
const _ = require('lodash')
const parser = require('xml2json')
const config = require('config')
const qs = require('qs')
const log = require('./lib/log')('soap')

module.exports = { getDocumentsSince }

async function getDocumentsSince (sessionId, since) {
  log.info(`Fetching documents since ${since || 'forever'}`)
  const history = await getHistory(sessionId)
  const toReturn = []
  for (const document of history) {
    const createdAt = new Date(
      `${document.createddate}T${document.createdtime}Z`
    )
    if (since && createdAt <= since) continue

    log.info(`Fetching file '${document.details}'`)
    document.file = await getFile(sessionId, document)
    if (document.attachments) {
      for (const attachment of document.attachments) {
        log.info(`Fetching attachment '${attachment.details}'`)
        attachment.file = await getFile(sessionId, attachment)
      }
    }
    toReturn.push(document)
  }
  return toReturn
}

async function getHistory (sessionId) {
  const res = await soap(
    'proGetCaseHistory',
    `
    <csessionid>${sessionId}</csessionid>
    <ccaseno>${config.fileview.username}</ccaseno>
    <ccorrtype></ccorrtype>
    <cactiontypes></cactiontypes>
    <csortfield></csortfield>
    <cdatesortorder></cdatesortorder>
    <imaxresults>2000</imaxresults>
    <coptions>FILEVIEW-ONLY</coptions>
    <clastserialno></clastserialno>
  `
  )

  const history = res.ttHistory.ttHistoryRow
  const attachments = res.ttAttachments.ttAttachmentsRow
  for (const attachment of attachments) {
    const historyItem = history.find(h => h.serialno === attachment.serialno)
    historyItem.attachments = historyItem.attachments || []
    historyItem.attachments.push(attachment)
  }

  return history
}

async function getFile (sessionId, { detail, documentcode, documentformat }) {
  const doc = await soap(
    'proGetDocument',
    `
    <csessionid>${sessionId}</csessionid>
    <cdocumentcode>${documentcode}</cdocumentcode>
    <cdocumentformat>${documentformat}</cdocumentformat>
  `
  )

  const data = _.get(doc, 'ttFile.ttFileRow.filedata')
  if (!data) return
  return Buffer.from(data, 'base64')
}

async function soap (action, body) {
  const { data } = await axios.post(
    'https://www.fileview.net/fileview-2.0/strategalaw/strategalaw_proxy.php',
    `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:xsd="http://www.w3.org/2001/XMLSchema"
      xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <${action} xmlns="urn:services-eclipse-co-uk:proclaim:proclaim:Proclaim">
          ${body}
        </${action}>
      </soap:Body>
    </soap:Envelope>`
  )

  const json = JSON.parse(parser.toJson(data))
  return json['SOAP-ENV:Envelope']['SOAP-ENV:Body'][action + 'Response']
}
