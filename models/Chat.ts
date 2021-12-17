import mongoose = require('mongoose')

const Schema = mongoose.Schema

const ChatSchema = new Schema(
  {
    id: String,
    settings: {
      stl: { type: String, default: 'English' },
      spc: { type: Boolean, default: false }
    },
    contactedAt: { type: Date, default: Date.now }
  },
  {
    collection: 'num-eleven-db'
  }
)

export = mongoose.model('ChatSchema', ChatSchema)
