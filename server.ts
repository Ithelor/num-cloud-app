process.env.NTBA_FIX_319 = '1'

import TelegramBot = require('node-telegram-bot-api')
import mongoose = require('mongoose')

import {
	getCodeByName,
	getNameByCode,
	translate,
	translateText
} from './util/Translator'
import { SendMessageOptions } from 'node-telegram-bot-api'
import ChatSchema = require('./models/Chat')

require('dotenv').config({
	path: 'config/.env'
})

const MONGO_URI = process.env['MONGO_URI']!

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
	console.log(`Database connection error: ${err}. Shutting down..`)
	process.exit(1)
}

const token = process.env['API_KEY']
const bot = new TelegramBot(token!, { polling: true })

bot.on('message', (msg) => {
	console.log(msg.text)
})

//	Handling /start
bot.onText(/\/start/, (msg: TelegramBot.Message) => {
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

//	Handling /t -text-
bot.onText(/\/t\s(.+)|\/t@CloudElevenBot\s(.+)/, (msg: any, match: any) => {
	const params = {
		reply_to_message_id: msg.message_id
	}
	const resp: string = match?.[1] || match?.[2]

	ChatSchema.findOne({ id: msg.chat.id }).then(
		(data: { settings: { stl: string } }) => {
			translateText(resp, data.settings.stl || 'en').then((res) => {
				return bot.sendMessage(msg.chat.id, (res ??= ''), params)
			})
		}
	)
})

//	Handling /tl -language- -text-
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
				bot.sendMessage(msg.chat.id, (res ??= ''))
			})
		})
	}
)

//	Handling /stl -lang-
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
		langName = gotNameByCode ??=
			langName.charAt(0).toUpperCase() + langName.slice(1)

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
				if (!err)
					mes = `Current target language: ${data}\nauto: ${res.settings.spc}`
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

/* Handling alternative queries */

//	Handling /tl
bot.onText(/\/tl$|\/tl@CloudElevenBot$/, async (msg: any) => {
	const params = {
		reply_to_message_id: msg.message_id
	}

	bot.sendMessage(
		msg.chat.id,
		`Please specify target language and text`,
		params
	)
})

// TODO: two-way lang check
//	Handling /tl -lang-
bot.onText(
	/\/tl ([A-Za-z]+)$|\/tl@CloudElevenBot ([A-Za-z]+)$/,
	async (msg: any, match: any) => {
		const params: SendMessageOptions = {
			reply_to_message_id: msg.message_id
		}

		let resp: string
		const lang: string = match?.[1] || match?.[2]

		if (msg.reply_to_message) {
			resp = msg.reply_to_message.text

			translateText(resp, lang!).then((res) => {
				return bot.sendMessage(msg.chat.id, res, params)
			})
		} else {
			bot.sendMessage(
				msg.chat.id,
				`Please specify text or reply to a message`,
				params
			)
		}
	}
)

//	Handling /stl
bot.onText(/\/stl$|\/stl@CloudElevenBot$/, async (msg: any) => {
	const params = {
		reply_to_message_id: msg.message_id
	}
	bot.sendMessage(msg.chat.id, `Please specify target language`, params)
})

// Handling inlines
// TODO: fix double space ?
bot.on('inline_query', async (msg) => {
	if (msg.query) {
		let [, nope, lang, text] = msg.query.match(/(\w+)$|(\w+)\s(.+)/) || []

		// lang:
		// 	get name: if not => already a name [1] or invalid,
		//		[1] get code: if not => 				 				invalid,
		//			get name.

		console.log(msg.query.match(/(\w+)$|(\w+)\s(.+)/))

		if (!nope) {
			let title: string, description: string, langCode: string, langName: string

			// TODO: detect original lang

			let detectedLanguage = await translate.detect(msg.query),
				gotNameByCode = await getNameByCode(lang)

			let dLang: string

			Promise.all([gotNameByCode, detectedLanguage])
				.then((data) => {
					if (data[0]) {
						langName = data[0]
						console.log(`[1] langName: ${langName}`)
					} else {
						console.log(`Elsed`)
						getCodeByName(lang).then((code) => {
							if (code) {
								langCode = code
								getNameByCode(code).then((name) => {
									langName = name
									console.log(`[2] langName: ${langName}`)
								})
							} else {
								title = `Error: Invalid Query`
								description = `Please follow the "language text" syntax`

								console.log(`Errored`)

								// TODO: fix
								bot.answerInlineQuery(msg.id, [
									{
										type: 'article',
										id: `ID${msg.query}`,
										title: title,
										description: description,

										input_message_content: {
											message_text: `(-): `
										}
									}
								])
							}
						})
					}
				})
				.then(() => {
					translateText(text, (langCode ??= lang)).then((data) => {
						title = `Translation (${langName}): ${data}`
						description = `Original (${dLang}): ${text}`

						// TODO: fix
						bot.answerInlineQuery(msg.id, [
							{
								type: 'article',
								id: `ID${msg.query}`,
								title: title,
								description: description,

								input_message_content: {
									message_text: `(-): `
								}
							}
						])
					})
				})
		}
	}
})
