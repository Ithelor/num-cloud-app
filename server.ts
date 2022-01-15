process.env.NTBA_FIX_319 = '1'

require('dotenv').config({
  path: 'config/.env'
})

import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import mongoose from 'mongoose'

import {
  getCodeByName,
  getNameByCode,
  translate,
  translateText
} from './util/Translator'
import { uploadObject, deleteObject, waitUntilExists } from './util/Storage'
import speechToText from './util/SpeechToText'

import UserSchema from './models/User'

const MONGO_URI = process.env.MONGO_URI!

try {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(`Database connected`)
    })
    .catch((err) => {
      console.error(err)
    })
} catch (err) {
  console.log(`Database connection error: ${err}. Shutting down..`)
  process.exit(1)
}

const token = process.env.API_KEY
const bot = new TelegramBot(token!, { polling: true })

// /tl -language- -text-
bot.onText(
  /\/tl\s([A-Za-z]+)\s(.+)|\/tl@CloudElevenBot\s([A-Za-z]+)\s(.+)/,
  async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const params: SendMessageOptions = {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML'
    }
    let lang = match?.[1] || match?.[3]
    let resp = match?.[2] || match?.[4]

    const gotNameByCode = await getNameByCode(lang!),
      gotCodeByName = await getCodeByName(lang!)

    Promise.all([gotNameByCode, gotCodeByName]).then((data) => {
      if (!data[0] && !data[1]) {
        return bot.sendMessage(
          msg.chat.id,
          `<i>Language not recognized. Please try again...</i>`,
          params
        )
      }

      lang = data[1] ??= lang

      translateText(resp!, lang!).then((res) => {
        bot.sendMessage(msg.chat.id, res, params)
      })
    })
  }
)

// Alternative /tl -lang-
bot.onText(
  /\/tl ([A-Za-z]+)$|\/tl@CloudElevenBot ([A-Za-z]+)$/,
  async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    let params: SendMessageOptions = {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML'
    }

    let resp: string
    let lang: string = match?.[1]!

    let gotNameByCode = await getNameByCode(lang),
      gotCodeByName = await getCodeByName(lang)

    Promise.all([gotNameByCode, gotCodeByName]).then(async (data) => {
      if (!data[0] && !data[1]) {
        return bot.sendMessage(
          msg.chat.id,
          `<i>Language not recognized. Please try again...</i>`,
          params
        )
      }

      lang = gotCodeByName ??= lang

      if (msg.reply_to_message) {
        params = {
          ...params,
          reply_to_message_id: msg.reply_to_message!.message_id
        }
        // Handling voice messages
        if (msg.reply_to_message.voice) {
          UserSchema.findOne(
            { id: msg!.reply_to_message!.from!.id },
            async (err: string, data: { until: Date }) => {
              if (data) {
                if (data.until > new Date()) {
                  await bot
                    .getFileLink(msg.reply_to_message!.voice!.file_id)
                    .then(async (url) => {
                      // TEMPORAL upload to Google Cloud Storage
                      // literally like for 5 seconds 🙄
                      const path = `audio-files/${String(msg.from!.id)}/${
                        msg.reply_to_message!.voice!.file_id
                      }.ogg`
                      uploadObject(url, path).then(() => {
                        bot
                          .sendMessage(
                            msg.chat.id,
                            `🕚 <i>Audio uploaded, running transcription...</i>`,
                            {
                              reply_to_message_id: msg.reply_to_message!.message_id,
                              parse_mode: 'HTML'
                            }
                          )
                          .then((msgData) => {
                            waitUntilExists(path).then(() => {
                              speechToText(path).then((stt_data) => {
                                bot.editMessageText(
                                  `🕚 <i>Audio transcripted, running translation...</i>`,
                                  {
                                    chat_id: msgData.chat.id,
                                    message_id: msgData.message_id,
                                    parse_mode: 'HTML'
                                  }
                                )
                                translateText(String(stt_data), lang).then((res) => {
                                  return bot.editMessageText(res, {
                                    chat_id: msgData.chat.id,
                                    message_id: msgData.message_id
                                  })
                                })
                                deleteObject(path)
                              })
                            })
                          })
                      })
                    })
                } else {
                  bot.sendMessage(
                    msg.chat.id,
                    `<i>Your subscription has expired.</i>\nIf you consider renewing it, see /subscribe`,
                    {
                      reply_to_message_id: msg.message_id,
                      parse_mode: 'HTML'
                    }
                  )
                }
              } else {
                bot.sendMessage(
                  msg.chat.id,
                  `<i>Voice messages translation is available via paid subscription.</i>\nSee /subscribe`,
                  {
                    reply_to_message_id: msg.message_id,
                    parse_mode: 'HTML'
                  }
                )
              }
            }
          )
        } else {
          resp = msg.reply_to_message.text!

          translateText(resp, lang!).then((res) => {
            return bot.sendMessage(msg.chat.id, res, params)
          })
        }
      } else {
        bot.sendMessage(
          msg.chat.id,
          `<i>Please specify text or reply to a message</i>`,
          params
        )
      }
    })
  }
)

// /subscribe
bot.onText(/\/subscribe/, async (msg: TelegramBot.Message) => {
  const params = {
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Proceed to checkout',
            callback_data: 'sub'
          }
        ]
      ]
    }
  }

  bot.sendMessage(
    msg.chat.id,
    `Generated @${
      msg.from!.username
    }'s unique checkout link.\nIf you indend to proceed, use the button below.`,
    params
  )
})

// Callbacks
bot.on('callback_query', (callbackQuery) => {
  if (callbackQuery.data === 'sub') {
    const msg = callbackQuery.message

    bot.answerCallbackQuery(callbackQuery.id).then(() => {
      const expires = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        new Date().getDate()
      ).toDateString()
      let newExpires: string

      UserSchema.findOne(
        { id: msg!.reply_to_message!.from!.id },
        (err: string, data: { until: Date }) => {
          if (data) {
            if (data.until > new Date()) {
              newExpires = new Date(
                data.until.setMonth(data.until.getMonth() + 1)
              ).toDateString()
            }
          }
          UserSchema.findOneAndUpdate(
            { id: msg!.reply_to_message!.from!.id },
            { until: newExpires ?? expires },
            { upsert: true, new: true, setDefaultsOnInsert: true },
            (err) => {
              if (err) {
                return console.log(`An error occured while saving a model: ${err}`)
              } else {
                bot.editMessageText(
                  `@${
                    msg!.reply_to_message!.from!.username
                  } subscribed succesfully.\nExpiration date - <i>${
                    newExpires ?? expires
                  }</i>`,
                  {
                    chat_id: msg!.chat.id,
                    message_id: msg!.message_id,
                    parse_mode: 'HTML'
                  }
                )
              }
            }
          )
        }
      )
    })
  }
})

// Inlines
bot.on('inline_query', async (msg: TelegramBot.InlineQuery) => {
  if (msg.query) {
    let [, nope, lang, text] = msg.query.match(/(\w+)$|(\w+)\s(.+)/) || []
    let title: string, description: string, message_text: string

    // lang:
    // 	get name: if not => already a name [1] or invalid,
    //		[1] get code: if not => invalid,
    //			get name.

    if (nope) {
      title = `Error: Expected 2 arguments`
      description = `Please follow the "language text" syntax`
      message_text = `${title}\n${description}`

      bot.answerInlineQuery(msg.id, [
        {
          type: 'article',
          id: `ID${msg.query}`,
          title: title,
          description: description,

          input_message_content: {
            message_text: message_text
          }
        }
      ])
    } else {
      let langCode: string, langName: string

      let [detectedLanguage] = await translate.detect(msg.query),
        detectedLanguageName = await getNameByCode(detectedLanguage.language),
        gotNameByCode = await getNameByCode(lang)

      Promise.all([gotNameByCode, detectedLanguage])
        .then((data) => {
          if (data[0]) {
            langCode = lang
            langName = data[0]
          } else {
            getCodeByName(lang).then((code) => {
              if (code) {
                langCode = code
                getNameByCode(code).then((name) => {
                  langName = name
                })
              } else {
                title = `Error: Invalid Target Language`
                description = `Please follow the "language text" syntax`
              }
            })
          }
        })
        .then(() => {
          translateText(text, langCode).then((data) => {
            title ??= `Translation (${langName}): ${data}`
            description ??= `Original (${detectedLanguageName}): ${text}`
            message_text = data

            bot.answerInlineQuery(msg.id, [
              {
                type: 'article',
                id: `ID${msg.query}`,
                title: title,
                description: description,

                input_message_content: {
                  message_text: message_text
                }
              }
            ])
          })
        })
    }
  }
})

// Incorrect /tl
bot.onText(/\/tl$|\/tl@CloudElevenBot$/, async (msg: TelegramBot.Message) => {
  const params: SendMessageOptions = {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  }

  bot.sendMessage(
    msg.chat.id,
    `<i>Incorrect query.\nPlease either follow "language text" syntax or reply to a message with language specified</i>`,
    params
  )
})
