process.env.NTBA_FIX_319 = '1'

import TelegramBot = require('node-telegram-bot-api')
import mongoose = require('mongoose')
import {
    translate,
    listLanguages,
    detectLanguage,
    translateText
} from './util/Translator'
import ChatSchema = require('./models/Chat')
import dotenv from 'dotenv'

dotenv.config({ path: 'config/.env' })

const MONGO_URI = (process.env['MONGO_URI'] ??= '')

try {
    mongoose
        .connect(MONGO_URI)
        .then(() => {
            console.log(`MongoDB connected`)
        })
        .catch((err) => {
            console.error(err)
        })
} catch (err) {
    console.log(`Server error: ${err.message}`)
    process.exit(1)
}

const token = process.env['API_KEY']
const bot = new TelegramBot(token!, { polling: true })

//	Handling /init
bot.onText(/\/init/, (msg) => {
    const chatId = msg.chat.id

    const Chat = new ChatSchema({ id: chatId, contactedAt: Date.now() })

    Chat.save((err: never) => {
        if (err)
            return console.log(`An error occured while saving a model: ${err}`)
        console.log(`A model saved succesfully`)
    })

    console.log(`response: Initialized`)
    bot.sendMessage(chatId, 'Initialized')
})

//	Handling /translate
bot.onText(/\/translate (.+)/, (msg, match) => {
    const chatId = msg.chat.id

    const resp: string = match?.[1] || ''

    translateText(resp, 'en').then((res) => {
        console.log(`response: ${res}`)
        bot.sendMessage(chatId, (res ??= ''))
    })
})

//	Handling /stl
bot.onText(/\/stl (.+)/, (msg, match) => {
    const chatId = msg.chat.id
    const resp: string = match?.[1] || ''

    // TODO: either inline keyboard or just message parsing idk
})

bot.on('message', (msg) => {
    console.log(`request: ${msg.text}`)
})
