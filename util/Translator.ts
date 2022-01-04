import { Translate } from '@google-cloud/translate/build/src/v2'

require('dotenv').config({ path: 'config/.env' })

const CREDENTIALS = JSON.parse((process.env['CREDENTIALS'] ??= ''))
const translate = new Translate({
  credentials: CREDENTIALS,
  projectId: CREDENTIALS.project_id
})

const translateText = async (text: string, targetLanguage: string) => {
  let result: string

  try {
    ;[result] = await translate.translate(text, targetLanguage)
  } catch (err) {
    result = `Error: Invalid Target Language`
  }

  return result
}

let languages: any
translate.getLanguages().then((response) => {
  ;[languages] = response
})

const getNameByCode = async (code: string) => {
  for (const language of languages) {
    if (code.localeCompare(language.code) === 0) return language.name
  }

  return
}

const getCodeByName = async (name: string) => {
  for (const language of languages) {
    if (name.toLowerCase().localeCompare(language.name.toLowerCase()) === 0)
      return language.code
  }

  return
}

export { translate, translateText, getNameByCode, getCodeByName }
