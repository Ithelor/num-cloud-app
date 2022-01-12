process.env.NTBA_FIX_319 = '1'

require('dotenv').config({
  path: 'config/.env'
})

import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import mongoose, { Mongoose } from 'mongoose'

import {
  getCodeByName,
  getNameByCode,
  translate,
  translateText
} from './util/Translator'
import { uploadObject, deleteObject, waitUntilExists } from './util/Storage'
import speechToText from './util/SpeechToText'

import ChatSchema from './models/Chat'
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

// Handling /start
bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
  const params = { reply_to_message_id: msg.message_id }
  const Chat = new ChatSchema({ id: msg.chat.id, contactedAt: Date.now() })

  ChatSchema.findOne({ id: msg.chat.id }, (err: any, data: any) => {
    if (err) {
      console.log(`An error occured: ${err}`)
    } else {
      if (data) {
        bot.sendMessage(
          msg.chat.id,
          `This chat has already been initialized - @${msg.from!.username}`,
          params
        )
      } else {
        Chat.save((err: never) => {
          if (err) {
            return console.log(`An error occured while saving a model: ${err}`)
          }
        })
        bot.sendMessage(msg.chat.id, `Initialized succesfully`, params)
      }
    }
  })
})

// Handling /t -text-
bot.onText(/\/t\s(.+)|\/t@CloudElevenBot\s(.+)/, (msg: any, match: any) => {
  const params = {
    reply_to_message_id: msg.message_id
  }
  const resp: string = match?.[1] || match?.[2]

  ChatSchema.findOne({ id: msg.chat.id }).then(
    (data: { settings: { stl: string } }) => {
      translateText(resp, data.settings.stl || 'en').then((res) => {
        return bot.sendMessage(msg.chat.id, res, params)
      })
    }
  )
})

// Handling /tl -language- -text-
// TODO: fix no reply
bot.onText(
  /\/tl\s([A-Za-z]+)\s(.+)|\/tl@CloudElevenBot\s([A-Za-z]+)\s(.+)/,
  async (msg: any, match: any) => {
    const params = { reply_to_message_id: msg.message_id }
    let lang: string = match?.[1] || match?.[3]
    let resp: string = match?.[2] || match?.[4]

    const gotNameByCode = await getNameByCode(lang),
      gotCodeByName = await getCodeByName(lang)

    Promise.all([gotNameByCode, gotCodeByName]).then((data) => {
      if (!data[0] && !data[1]) {
        return bot.sendMessage(
          msg.chat.id,
          `Language not recognized. Please try again`,
          params
        )
      }

      lang = data[1] ??= lang

      translateText(resp, lang).then((res) => {
        bot.sendMessage(msg.chat.id, res)
      })
    })
  }
)

// Handling /stl -lang-
bot.onText(/\/stl (.+)/, async (msg: any, match: any) => {
  const params = {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML' as TelegramBot.ParseMode
  }
  let lang: string = match?.[1]!
  let langName: string = match?.[1]!

  let gotNameByCode = await getNameByCode(lang),
    gotCodeByName = await getCodeByName(lang)

  Promise.all([gotNameByCode, gotCodeByName]).then((data) => {
    if (!data[0] && !data[1]) {
      return bot.sendMessage(
        msg.chat.id,
        `Language not recognized. Please try again`,
        params
      )
    }

    lang = gotCodeByName ??= lang
    langName = gotNameByCode ??= langName.charAt(0).toUpperCase() + langName.slice(1)

    ChatSchema.findOne(
      { id: msg.chat.id },
      (err: any, res: { settings: { stl: string } }) => {
        if (lang.localeCompare(res.settings.stl) === 0) {
          return bot.sendMessage(
            msg.chat.id,
            `<b><i>${langName}</i></b> already set as a target language`,
            params
          )
        }
        ChatSchema.updateOne(
          { id: msg.chat.id },
          { settings: { stl: lang } },
          { upsert: true }
        )
          .then(() => {
            return bot.sendMessage(
              msg.chat.id,
              `<b><i>${langName}</i></b> set as a target language`,
              params
            )
          })
          .catch((err: any) => {
            console.log(`An error occured while updating a model: ${err}`)
          })
      }
    )
  })
})

//	Handling /status
bot.onText(/\/status/, async (msg: any, match: any) => {
  const params = {
    reply_to_message_id: msg.message_id
  }

  ChatSchema.findOne(
    { id: msg.chat.id },
    (err: any, res: { settings: { stl: string; spc: boolean } }) => {
      let mes: string
      getNameByCode(res.settings.stl).then((data) => {
        if (!err) mes = `Current target language: ${data}\nauto: ${res.settings.spc}`
        else mes = `Unable to fetch chat settings`

        bot.sendMessage(msg.chat.id, mes, params)
      })
    }
  )
})

//	Handling /t
bot.onText(/\/t$|\/t@CloudElevenBot$/, async (msg: any) => {
  const params = {
    reply_to_message_id: msg.message_id
  }
  let resp: string, lang: string, opts: SendMessageOptions

  if (msg.reply_to_message) {
    ChatSchema.findOne({ id: msg.chat.id }).then(
      (data: { settings: { stl: string } }) => {
        lang = data.settings.stl
        resp = msg.reply_to_message.text

        translateText(resp, lang || 'en').then((res) => {
          return bot.sendMessage(msg.chat.id, (res ??= ''), params)
        })
      }
    )
  } else {
    return bot.sendMessage(
      msg.chat.id,
      `Please specify text or reply to a message`,
      params
    )
  }
})

// Handling /subscribe
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

// Handling callback queries
bot.on('callback_query', (callbackQuery) => {
  if (callbackQuery.data === 'sub') {
    const msg = callbackQuery.message

    bot.answerCallbackQuery(callbackQuery.id).then(() => {
      console.log(msg!)

      const expires = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        new Date().getDate()
      ).toDateString()
      let newExpires: string

      UserSchema.findOne(
        { id: msg!.reply_to_message!.from!.id },
        (err: any, data: any) => {
          if (data) {
            newExpires = new Date(
              data.until.setMonth(data.until.getMonth() + 1)
            ).toDateString()
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
                  } subscribed succesfully. Expiration date - ${
                    newExpires ?? expires
                  }`,
                  {
                    chat_id: msg!.chat.id,
                    message_id: msg!.message_id
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

/*
  Handling alternative / incorrect queries
*/

// Handling /tl
bot.onText(/\/tl$|\/tl@CloudElevenBot$/, async (msg: any) => {
  const params = {
    reply_to_message_id: msg.message_id
  }

  bot.sendMessage(msg.chat.id, `Please specify target language and text`, params)
})

// Handling /tl -lang-
bot.onText(
  /\/tl ([A-Za-z]+)$|\/tl@CloudElevenBot ([A-Za-z]+)$/,
  async (msg: any, match: any) => {
    let params: SendMessageOptions = {
      reply_to_message_id: msg.message_id
    }

    let resp: string

    let lang: string = match?.[1]!
    let langName: string = match?.[1]!

    let gotNameByCode = await getNameByCode(lang),
      gotCodeByName = await getCodeByName(lang)

    Promise.all([gotNameByCode, gotCodeByName]).then(async (data) => {
      if (!data[0] && !data[1]) {
        return bot.sendMessage(
          msg.chat.id,
          `Language not recognized. Please try again`,
          params
        )
      }

      lang = gotCodeByName ??= lang
      langName = gotNameByCode ??=
        langName.charAt(0).toUpperCase() + langName.slice(1)

      if (msg.reply_to_message) {
        params = {
          ...params,
          reply_to_message_id: msg.reply_to_message!.message_id
        }
        if (msg.reply_to_message.voice) {
          UserSchema.findOne(
            { id: msg!.reply_to_message!.from!.id },
            async (err: any, data: any) => {
              if (data) {
                if (data.until > new Date().getDate()) {
                  console.log(
                    `data.until (${
                      data.until
                    }) > new Date().getDate() ${new Date().getDate()}`
                  )
                  await bot
                    .getFileLink(msg.reply_to_message.voice!.file_id)
                    .then(async (url) => {
                      // TEMPORAL upload to Google Cloud Storage
                      // seriously like for 5 seconds 🙄
                      const path = `audio-files/${String(msg.from!.id)}/${
                        msg.reply_to_message.voice!.file_id
                      }.ogg`
                      uploadObject(url, path).then(() => {
                        bot
                          .sendMessage(
                            msg.chat.id,
                            `Audio uploaded, running transcription`,
                            {
                              reply_to_message_id: msg.reply_to_message.message_id
                            }
                          )
                          .then((msgData) => {
                            waitUntilExists(path).then(() => {
                              speechToText(path).then((stt_data) => {
                                bot.editMessageText(
                                  `Audio transcripted, running translation`,
                                  {
                                    chat_id: msgData.chat.id,
                                    message_id: msgData.message_id
                                  }
                                )
                                translateText(String(stt_data), lang).then((res) => {
                                  // return bot.sendMessage(msg.chat.id, res, params)
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
                }
              } else {
                bot.sendMessage(
                  msg.chat.id,
                  `Voice messages translation is available via paid subscription.\nSee /subscribe`,
                  {
                    reply_to_message_id: msg.message_id
                  }
                )
              }
            }
          )
        } else {
          resp = msg.reply_to_message.text

          translateText(resp, lang!).then((res) => {
            return bot.sendMessage(msg.chat.id, res, params)
          })
        }
      } else {
        bot.sendMessage(
          msg.chat.id,
          `Please specify text or reply to a message`,
          params
        )
      }
    })
  }
)

// Handling /stl
bot.onText(/\/stl$|\/stl@CloudElevenBot$/, async (msg: any) => {
  const params = {
    reply_to_message_id: msg.message_id
  }
  bot.sendMessage(msg.chat.id, `Please specify target language`, params)
})

// Handling inlines
bot.on('inline_query', async (msg) => {
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
          })
        })
    }
  }
})
