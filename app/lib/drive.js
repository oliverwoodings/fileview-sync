const { google } = require('googleapis')
const path = require('path')

const TYPES = {
  folder: 'application/vnd.google-apps.folder'
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, '../../config/keyfile.json'),
  scopes: ['https://www.googleapis.com/auth/drive']
})

const drive = google.drive({
  version: 'v3',
  auth
})

module.exports = { list, create, types: TYPES }

async function list ({ parentId, mimeType, fields = 'files(id, name)' }) {
  const { data } = await drive.files.list({
    q: `mimeType = '${mimeType}' and '${parentId}' in parents and trashed = false`,
    spaces: 'drive',
    fields,
    pageSize: 1000
  })
  return data.files
}

async function create ({
  parentId,
  name,
  mimeType,
  body,
  fields = 'id, name',
  ...other
}) {
  const { data } = await drive.files.create({
    resource: {
      name,
      mimeType,
      parents: [parentId],
      ...other
    },
    media: {
      mimeType,
      body
    },
    fields
  })
  return data
}
