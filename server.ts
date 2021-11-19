process.env.NTBA_FIX_319 = '1'

import TelegramBot = require('node-telegram-bot-api')
import mongoose = require('mongoose')
import {
    detectLanguage,
    getCodeByName,
    getNameByCode,
    translateText
} from './util/Translator'
import ChatSchema = require('./models/Chat')
import {
    SendMessageOptions,
    KeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    InlineKeyboardButton
} from 'node-telegram-bot-api'
require('dotenv').config({ path: 'config/.env' })

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
    console.log(`Server error: ${err}`)
    process.exit(1)
}

const token = process.env['API_KEY']
const bot = new TelegramBot(token!, { polling: true })

//	Handling /init
bot.onText(/\/init/, (msg) => {
    const chatId = msg.chat.id

    const Chat = new ChatSchema({ id: chatId, contactedAt: Date.now() })

    ChatSchema.findOne({ id: chatId }, (err: any, data: any) => {
        if (err) {
            console.log(`An error occured: ${err}`)
        } else {
            if (data) {
                bot.sendMessage(chatId, 'Chat has already been initialized')
            } else {
                Chat.save((err: never) => {
                    if (err)
                        return console.log(
                            `An error occured while saving a model: ${err}`
                        )
                })
                bot.sendMessage(chatId, 'Initialized succesfully')
            }
        }
    })
})

//	Handling /translate -text-
bot.onText(/\/t (.+)/, (msg, match) => {
    const chatId = msg.chat.id
    const resp: string = match?.[1] || ''

    let lang: string
    ChatSchema.findOne({ id: chatId }).then(
        (data: { settings: { stl: string } }) => {
            lang = data.settings.stl
            translateText(resp, lang || 'en').then((res) => {
                return bot.sendMessage(chatId, (res ??= ''))
            })
        }
    )
})

//	Handling /translate -text- (to -language-)
bot.onText(/\/tt ([A-Za-z]+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const resp: string = match?.[2] || ''
    let lang: string = match?.[1] || ''

    getCodeByName(lang).then((res) => {
        console.log('res')
    })

    if (await getNameByCode(lang)) {
    } else if (await getCodeByName(lang)) {
        lang = (await getCodeByName(lang)) || ''
    } else {
        return bot.sendMessage(
            chatId,
            'Language not recognized. Please try again'
        )
    }

    translateText(resp, lang).then((res) => {
        bot.sendMessage(chatId, (res ??= ''))
    })
})

//	Handling /stl
bot.onText(/\/stl (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    let lang: string = match?.[1] || ''
    let langName: string

    // const opts: SendMessageOptions = {
    //     reply_to_message_id: msg.message_id,
    //     reply_markup: {
    //         resize_keyboard: true,
    //         one_time_keyboard: true,
    //         inline_keyboard: [
    //             [{ text: 'Button 1', callback_data: 'cb1' }],
    //             [{ text: 'Button 2', callback_data: 'cb2' }]
    //         ]
    //     } as InlineKeyboardMarkup
    // }
    // TODO:

    if (await getNameByCode(lang)) {
        langName = (await getNameByCode(lang)) || ''
    } else if (await getCodeByName(lang)) {
        lang = (await getCodeByName(lang)) || ''
        langName = (await getNameByCode(lang)) || ''
    } else {
        return bot.sendMessage(
            chatId,
            'Language not recognized. Please try again'
        )
    }

    ChatSchema.findOne(
        { id: chatId },
        (err: any, res: { settings: { stl: string } }) => {
            if (lang.localeCompare(res.settings.stl) === 0) {
                return bot.sendMessage(chatId, `${langName} already set`)
            }
            ChatSchema.updateOne(
                { id: chatId },
                { settings: { stl: lang } },
                { upsert: true }
            )
                .then(() => {
                    return bot.sendMessage(
                        chatId,
                        `New target language (${langName}) set`
                    )
                })
                .catch((err: any) => {
                    console.log(
                        `An error occured while updating a model: ${err}`
                    )
                })
        }
    )
})
