import { Translate } from '@google-cloud/translate/build/src/v2'
import dotenv from 'dotenv'

dotenv.config({ path: 'config/.env' })

const CREDENTIALS = JSON.parse((process.env['CREDENTIALS'] ??= ''))
const translate = new Translate({
    credentials: CREDENTIALS,
    projectId: CREDENTIALS.project_id
})
const listLanguages = async () => {
    const [languages] = await translate.getLanguages()

    console.log(`Languages: `)
    languages.forEach((language) => console.log(JSON.stringify(language)))
}

const detectLanguage = async (text: string) => {
    try {
        const response = await translate.detect(text)
        return response[0].language
    } catch (err) {
        console.log(`An error occured during language detection: ${err}`)
    }
    return
}

const translateText = async (text: string, targetLanguage: string) => {
    try {
        const [response] = await translate.translate(text, targetLanguage)
        return response
    } catch (err) {
        console.log(`An error occured during translation: ${err}`)
    }
    return
}

const stlDetectLanguage = async (text: string) => {
    try {
        const response = await translate.detect(text)
        return response[0].language
    } catch (err) {
        console.log(`An error occured during language detection: ${err}`)
    }
    return
}

export { translate, listLanguages, detectLanguage, translateText }
