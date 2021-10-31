const { Translate } = require('@google-cloud/translate').v2

require('dotenv').config({ path: 'config/.env' })

const { logger, log } = require('./Logger')

const CREDENTIALS = JSON.parse(process.env['CREDENTIALS'])
const translate = new Translate({
	credentials: CREDENTIALS,
	projectId: CREDENTIALS.project_id
})

const listLanguages = async () => {

	const [languages] = await translate.getLanguages()

	logger.silent('Languages: ')
	languages.forEach(language => logger.info(JSON.stringify(language)))
}

const detectLanguage = async (text) => {

	try {
		let response = await translate.detect(text)
		return response[0].language
	} catch (error) {
		log('ERROR', 'An error occured during language detection', error)
	} return
}

const translateText = async (text, targetLanguage) => {

	try {
		let [response] = await translate.translate(text, targetLanguage)
		return response
	} catch (error) {
		log('ERROR', 'An error occured during translation', error)
	} return
};

module.exports = { translate, listLanguages, detectLanguage, translateText }