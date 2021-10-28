import {Currency} from "../types/enums";
import {Addresses, IUser, User} from "./user";
import mongoose from "mongoose";


const Keys = {
    UserByAddress: (currency: Currency, address: string) => "user_" + currency + "_" + address,
    AddressByUser: (currency: Currency, id: string) => "address_" + currency + "_" + id,
}

export class DB {
    private readonly connectionString: string = ""

    constructor(connectionString: string) {
        this.connectionString = connectionString
    }

    public async connect() {
        await mongoose.connect(this.connectionString, {
            autoIndex: true,
            autoCreate: true,
        })
    }

    public async setUser(id: string, addresses: Addresses) {
        await User.create({
            _id: new mongoose.Types.ObjectId(),
            userId: id,
            lastNotification: 0,
            addresses: addresses
        })
    }

    public async hasUser(id: string): Promise<boolean> {
        const user: IUser | null = await User.findOne({
            userId: id
        })

        return user != null
    }

    public async getUsers(): Promise<Array<IUser>> {
        const users: Array<IUser>  = await User.find()
        return users
    }

    public async getUserIdByAddress(currency: Currency, address: string): Promise<IUser | null> {
        const addresses: Addresses = <Addresses>{}
        addresses[currency] = address

        const user: IUser | null = await User.findOne({
            addresses: addresses,
        })

        return user
    }
}
