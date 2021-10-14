import Keyv from "keyv";
import {Currency} from "./types/enums";

type Addresses = {
    [id in Currency]: string
};

const Keys = {
    UserByAddress: (currency: Currency, address: string) => "user_" + currency + "_" + address,
    AddressByUser: (currency: Currency, id: string) => "address_" + currency + "_" + id,
}

export class DB {
    private keyv: Keyv

    constructor(keyv: Keyv) {
        this.keyv = keyv
    }

    public async setUser(id: string, addresses: Addresses) {
        for (const currencyStr of Object.keys(addresses)) {
            const currency: Currency = Number(currencyStr)
            let isOK = await this.keyv.set(Keys.UserByAddress(currency, addresses[currency]), id)
            if (!isOK) {
                throw new Error("Error write to db")
            }

            isOK = await this.keyv.set(Keys.AddressByUser(currency, id), addresses[currency])
            if (!isOK) {
                throw new Error("Error write to db")
            }
        }
    }

    public async hasUser(id: string): Promise<boolean> {
        for (const currency of [Currency.DOT, Currency.KSM]) {
            const address = await this.keyv.get(Keys.AddressByUser(currency, id))
            if (address == undefined) {
                return false
            }

            if (await this.keyv.get(Keys.UserByAddress(currency, address)) == undefined) {
                return false
            }
        }

        return true
    }

    public async getUserIdByAddress(currency: Currency, address: string): Promise<string | undefined> {
        return await this.keyv.get(Keys.UserByAddress(currency, address))
    }

    public async getAddressesByUser(currency: Currency, id: string): Promise<string | undefined> {
        return await this.keyv.get(Keys.AddressByUser(currency, id))
    }
}
