const config = require('config')
const _ = require('lodash')
const intoStream = require('into-stream')
const log = require('./lib/log')
const getSessionId = require('./getSessionId')
const soap = require('./soap')
const drive = require('./lib/drive')
const html2pdf = require('./lib/html2pdf')
const twilio = require('./lib/twilio')

const MIME_TYPES = {
  'html-html': 'text/html',
  'image-png': 'image/png',
  'image-jpeg': 'image/jpeg',
  'image-jpg': 'image/jpeg',
  'acrobat-pdf': 'application/pdf',
  'image-bmp': 'image/bmp',
  'other-zip': 'application/zip',
  'word-doc': 'application/msword'
}

module.exports = async function syncFileview () {
  const since = await getSince()
  const sessionId = await getSessionId()
  const documents = await soap.getDocumentsSince(sessionId, since)
  log.info(`Found ${documents.length} new documents to upload`)
  for (const document of documents) {
    await uploadDocument(document)
  }
  if (documents.length) {
    log.info(`Uploaded ${documents.length} documents`)
    await twilio.send(
      config.phoneNumber,
      `${documents.length} new document(s) are available in fileview`
    )
  }
}

async function getSince () {
  const files = await drive.list({
    parentId: config.drive.folderId,
    mimeType: drive.types.folder
  })
  return _(files)
    .map(file => {
      const [date, time] = file.name.split(' ')
      return new Date(`${date}T${time}Z`)
    })
    .orderBy(date => date.getTime(), 'desc')
    .first()
}

async function uploadDocument (document) {
  const createdTime = `${document.createddate}T${document.createdtime}Z`
  const folderName = `${document.createddate} ${document.createdtime} - ${document.details}`
  log.info(`Uploading ${folderName}`)
  const folder = await drive.create({
    parentId: config.drive.folderId,
    name: folderName,
    mimeType: drive.types.folder,
    createdTime,
    modifiedTime: createdTime
  })
  if (document.file) {
    await uploadFile(folder.id, document)
  }

  await drive.create({
    parentId: folder.id,
    name: 'meta.json',
    mimeType: 'application/json',
    createdTime,
    modifiedTime: createdTime,
    body: intoStream(JSON.stringify(getMeta(document), null, 2))
  })

  if (document.attachments) {
    const attachmentsFolder = await drive.create({
      parentId: folder.id,
      name: 'Attachments',
      mimeType: drive.types.folder,
      createdTime,
      modifiedTime: createdTime
    })
    for (const attachment of document.attachments) {
      log.info(`Uploading attachment ${attachment.details}`)
      await uploadFile(attachmentsFolder.id, attachment)
    }
  }
}

async function uploadFile (folderId, document) {
  const createdTime = `${document.createddate}T${document.createdtime}Z`
  const mimeType = MIME_TYPES[document.documentformat.toLowerCase()]
  if (!mimeType) {
    throw new Error(
      `Cannot find mime type for document type '${document.documentformat}'`
    )
  }
  await drive.create({
    parentId: folderId,
    body: intoStream(document.file),
    mimeType,
    name: document.details,
    createdTime,
    modifiedTime: createdTime
  })
  if (mimeType === 'text/html') {
    await drive.create({
      parentId: folderId,
      body: intoStream(await html2pdf(document.file.toString())),
      mimeType: 'application/pdf',
      name: document.details,
      createdTime: createdTime,
      modifiedTime: createdTime
    })
  }
}

function getMeta ({ attachments = [], file, ...other }) {
  return {
    ...other,
    attachments: attachments.map(getMeta)
  }
}
