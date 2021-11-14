export {}

const logger = require("npmlog")
const fs = require("fs")

const log_file = fs.createWriteStream(__dirname + "/../debug.log", {
    flags: "a",
})

const initialize = () => {
    logger.prefixStyle = { fg: "magenta" }
    logger.headingStyle = { fg: "white", bg: "black" }

    logger.style = {}
    logger.levels = {}
    logger.disp = {}
    logger.addLevel("silly", -Infinity, { inverse: true }, "sill")
    logger.addLevel("verbose", 1000, { fg: "blue", bg: "black" }, "verb")
    logger.addLevel("info", 2000, { fg: "green" })
    logger.addLevel("http", 3000, { fg: "green", bg: "black" })
    logger.addLevel("warn", 4000, { fg: "black", bg: "yellow" }, "WARN")
    logger.addLevel("error", 5000, { fg: "red", bg: "black" }, "ERR!")
    logger.addLevel("silent", Infinity)

    logger.info("silly", "Logger initialized")

    return logger
}

const log = (status: any, prefix: any, message: any) => {
    const result = `${new Date().toISOString()} ${status} ${prefix}: ${message}`

    logger.info(result)
    log_file.write(result + "\n")
}

module.exports = { logger: initialize(), log }
