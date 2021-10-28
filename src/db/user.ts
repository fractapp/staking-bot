import { model, Schema, Document} from 'mongoose'
import {Currency} from "../types/enums";

export type Addresses = {
    [id in Currency]: string
};
export interface IUser extends Document {
    userId: string,
    lastNotification: number,
    addresses: Addresses
}

const schema = new Schema({
    _id: Schema.Types.ObjectId,
    userId: { type: String, required: true, index: true, unique: true },
    addresses: { type: Schema.Types.Mixed, required: true, index: true},
    lastNotification: Number,
});
export const User = model<IUser>("user", schema)
