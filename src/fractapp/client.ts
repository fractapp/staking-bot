import {Keyring} from "@polkadot/keyring";
import {stringToU8a, u8aToHex} from '@polkadot/util';
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {KeyringPair} from "@polkadot/keyring/types";
import {Currency, Network} from "../types/enums";
import {MessageRq, UndeliveredMessagesInfo} from "../types/api";
import axios from 'axios'
import {Const} from "../utils/const";

const authMsg = 'It is my fractapp rq:';
const signAddressMsg = 'It is my auth key for fractapp:';

const timeout = 5 * Const.Sec

export class FractappClient {
    private jwt: string | null = null
    private readonly host: string

    constructor(host: string = 'https://api.fractapp.com') {
        this.host = host
    }

    private async getAccount(seed: string, network: Network): Promise<KeyringPair> {
        let account;
        switch (network) {
            case Network.Polkadot:
                account = new Keyring({type: 'sr25519', ss58Format: 0}).addFromUri(seed);
                break;
            case Network.Kusama:
                account = new Keyring({
                    type: 'sr25519',
                    ss58Format: 2,
                }).addFromUri(seed);
        }

        return account;
    }

    private createAuthPubKeyHeaderWithKeyAndTime(
        rq: any,
        key: KeyringPair,
        time: number,
    ): string {
        const msg = authMsg + JSON.stringify(rq) + time;
        return u8aToHex(key.sign(stringToU8a(msg)));
    }

    public async auth(seed: string) {
        await cryptoWaitReady()
        let authKey = new Keyring({type: 'sr25519'}).addFromUri(seed + '//auth');

        let accountsRq: Record<Currency, any> = <Record<Currency, any>>{};
        const time = Math.round(new Date().getTime() / 1000);
        const authPubKey = u8aToHex(authKey.publicKey);

        const msg = signAddressMsg + authPubKey + time;

        const polkadotAccount = await this.getAccount(seed, Network.Polkadot)
        const kusamaAccount = await this.getAccount(seed, Network.Kusama)
        accountsRq[Network.Polkadot] = {
            Address: polkadotAccount.address,
            PubKey: u8aToHex(polkadotAccount.publicKey),
            Sign: u8aToHex(polkadotAccount.sign(stringToU8a(msg))),
        };
        accountsRq[Network.Kusama] = {
            Address: kusamaAccount.address,
            PubKey: u8aToHex(kusamaAccount.publicKey),
            Sign: u8aToHex(kusamaAccount.sign(stringToU8a(msg))),
        };

        const rq = {
            addresses: accountsRq,
            type: 2, //CryptoAddress
        };

        const sign = this.createAuthPubKeyHeaderWithKeyAndTime(rq, authKey, time);
        const response = await axios.post(`${this.host}/auth/signin`, rq, {
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
                'Sign-Timestamp': String(time),
                Sign: sign,
                'Auth-Key': authPubKey,
            },
        })

        if (response.status !== 200) {
            throw new Error("invalid auth")
        }
        this.jwt = response.data.token
    }

    public async getUnreadMessages(): Promise<UndeliveredMessagesInfo> {
        const response = await axios.get(`${this.host}/message/unread`, {
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'BEARER ' + this.jwt,
            },
        })

        if (response.status !== 200) {
            throw new Error("invalid auth")
        }

        return response.data
    }

    public async setRead(readMsgs: Array<string>): Promise<void> {
        const response = await axios.post(`${this.host}/message/read`, readMsgs, {
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'BEARER ' + this.jwt,
            },
        })

        if (response.status !== 200) {
            throw new Error("invalid set read")
        }
    }

    public async sendMsg(msg: MessageRq): Promise<void> {
        const response = await axios.post(`${this.host}/message/send`, msg, {
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'BEARER ' + this.jwt,
            },
        })

        if (response.status !== 200) {
            throw new Error("invalid send msg")
        }
    }
}
