import { LanguageResult } from '@google-cloud/translate/build/src/v2'
import { Translate } from '@google-cloud/translate/build/src/v2'
require('dotenv').config({ path: 'config/.env' })

const CREDENTIALS = JSON.parse((process.env['CREDENTIALS'] ??= ''))
const translate = new Translate({
    credentials: CREDENTIALS,
    projectId: CREDENTIALS.project_id
})

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

const listLanguages = async () => {
    const [languages] = await translate.getLanguages()

    console.log(`Languages: `)
    languages.forEach((language) => console.log(JSON.stringify(language)))
}

// Literally the only working approach (see loop) OR/AND I'm retarded
const getNameByCode = async (code: string) => {
    const [languages] = await translate.getLanguages()
    for (const language of languages) {
        if (code.localeCompare(language.code) === 0) return language.name
    }

    return
}

// Same as getNameByCode()
const getCodeByName = async (name: string) => {
    const [languages] = await translate.getLanguages()
    for (const language of languages) {
        if (name.toLowerCase().localeCompare(language.name.toLowerCase()) === 0)
            return language.code
    }

    return
}

export {
    translate,
    detectLanguage,
    translateText,
    getNameByCode,
    getCodeByName
}
