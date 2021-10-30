const log = require('npmlog')
const fs = require('fs')

const log_file = fs.createWriteStream(__dirname + '/debug.json', { flags: 'a' });

function initialize() {

    log.prefixStyle = { fg: 'magenta' }
    log.headingStyle = { fg: 'white', bg: 'black' }

    log.style = {}
    log.levels = {}
    log.disp = {}
    log.addLevel('silly', -Infinity, { inverse: true }, 'sill')
    log.addLevel('verbose', 1000, { fg: 'blue', bg: 'black' }, 'verb')
    log.addLevel('info', 2000, { fg: 'green' })
    log.addLevel('http', 3000, { fg: 'green', bg: 'black' })
    log.addLevel('warn', 4000, { fg: 'black', bg: 'yellow' }, 'WARN')
    log.addLevel('error', 5000, { fg: 'red', bg: 'black' }, 'ERR!')
    log.addLevel('silent', Infinity)

    log.info('silly', 'Logger initialized')

    return log
}

// TODO: error / warn / info objects ?
function dLog(prefix, message) {
    
    const result = JSON.stringify({
        prefix,
        message
    })

    log_file.write(result + '\n')
    log.info(result)
}

module.exports = { initialize, dLog }