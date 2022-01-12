import mongoose from 'mongoose'

const Schema = mongoose.Schema

const UserSchema = new Schema(
  {
    id: String,
    until: Date
  },
  {
    collection: 'users'
  }
)

export default mongoose.model('UserSchema', UserSchema)
