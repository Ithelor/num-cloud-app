const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config({ path: 'config/.env' })

const { logger, log } = require('./util/Logger')
const { translate, listLanguages, detectLanguage, translateText } = require('./util/Translator')

const token = process.env['API_KEY']

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/translate (.+)/, (msg, match) => {

	const chatId = msg.chat.id;
	const resp = match[1];

	translateText(resp, 'en')
		.then((res, err) => {
			log('INFO', 'response', res)
			bot.sendMessage(chatId, res);
		})

});

bot.on('message', (msg) => {
	
	log('WARN', 'request', msg.text)
});