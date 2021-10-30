const TelegramBot = require('node-telegram-bot-api');
const config = require('config')

const { initialize, dLog } = require('./Logger')

const log = initialize()

const token = config.get('API_KEY')

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/echo (.+)/, (msg, match) => {

	const chatId = msg.chat.id;
	const resp = match[1];

	bot.sendMessage(chatId, resp);
});

bot.on('message', (msg) => {
	const chatId = msg.chat.id;
	const message = msg.text

	dLog('sendMessage', message)

	bot.sendMessage(chatId, 'Received your message');
});