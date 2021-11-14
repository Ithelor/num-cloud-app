process.env.NTBA_FIX_319 = "1"

const TelegramBot = require("node-telegram-bot-api")
require("dotenv").config({ path: "config/.env" })

const { logger, log } = require("./util/Logger")
const {
    translate,
    listLanguages,
    detectLanguage,
    translateText,
} = require("./util/Translator")

const token = process.env["API_KEY"]

const bot = new TelegramBot(token, { polling: true })

//	Handling /translate
bot.onText(/\/translate (.+)/, (msg: { chat: { id: any } }, match: any[]) => {
    const chatId = msg.chat.id
    const resp = match[1]

    translateText(resp, "en").then((res: any, err: any) => {
        log("INFO", "response", res)
        bot.sendMessage(chatId, res)
    })
})

bot.on("message", (msg: { text: any }) => {
    log("WARN", "request", msg.text)
})
