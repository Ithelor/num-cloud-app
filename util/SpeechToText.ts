require('dotenv').config({
  path: 'config/.env'
})

import { SpeechClient } from '@google-cloud/speech/build/src/v1'

const client = new SpeechClient()

export default async (path: string) => {
  const gcsUri = `gs://${process.env.BUCKET_NAME}/${path}`

  const request = {
    audio: {
      uri: gcsUri
    },
    config: {
      encoding: 'OGG_OPUS' as any,
      sampleRateHertz: 16000,
      languageCode: 'ru-RU'
    }
  }

  const [response] = await client.recognize(request)

  const transcription = response.results!.map(
    (result) => result.alternatives![0].transcript
  )

  return transcription
}
