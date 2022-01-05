require('dotenv').config({
  path: 'config/.env'
})

import { File, Storage } from '@google-cloud/storage'
import axios from 'axios'

const uploadObject = async (url: string, path: string) => {
  const writeStream = new Storage()
    .bucket(process.env.BUCKET_NAME!)
    .file(path)
    .createWriteStream()
  const stream = await axios({ url, method: 'GET', responseType: 'stream' })
  stream.data.pipe(writeStream)
  stream.data.unpipe
}

const deleteObject = async (path: string) => {
  new Storage().bucket(process.env.BUCKET_NAME!).file(path).delete()
}

const waitUntilExists = async (path: string) => {
  let retries = 20
  let delay = 500

  const file = new Storage().bucket(process.env.BUCKET_NAME!).file(path)

  return new Promise((resolve, reject) => {
    const test = async () => {
      const fileExistsResponse = await file.exists()
      if (fileExistsResponse[0]) {
        return resolve(true)
      } else if (retries-- > 0) {
        setTimeout(test, delay)
      } else reject(`${retries} retries exhausted`)
    }
    setTimeout(test, delay)
  })
}

export { uploadObject, deleteObject, waitUntilExists }
