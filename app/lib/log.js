const driftwood = require('driftwood')

driftwood.enable({ '*': 'debug' })

module.exports = driftwood('fileview-sync')
