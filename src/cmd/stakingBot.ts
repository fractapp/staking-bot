import {DefaultMsgAction, Message, Profile} from "../types/api";
import {MsgAction, Network, toCurrency} from "../types/enums";
import {ApiPromise, WsProvider} from "@polkadot/api";
import dotenv from "dotenv";
import {ActionHandler} from "../stakingBot/actions";
import {FractappClient} from "../fractapp/client";
import {DB} from "../db/db";
import {Scheduler} from "../stakingBot/scheduler";
import {CacheClient} from "../utils/cacheClient";
import {Const} from "../utils/const";

dotenv.config()

const clientUrl = process.env["FRACTAPP_CLIENT_URL"] as string
const client = new FractappClient(clientUrl)
let actionHandler: ActionHandler

let cache: Map<Network, CacheClient> = new Map<Network, CacheClient>()

async function start() {
    const connectionString = process.env["MONGODB_CONNECTION"] as string
    const cacheServerPort = process.env["CACHE_PORT"] as string

    const seed = process.env["SEED"] as string
    const apiPolkadot = await getApiInstance(process.env["POLKADOT_RPC_URL"] as string)
    const apiKusama = await getApiInstance(process.env["KUSAMA_RPC_URL"] as string)

    cache.set(Network.Polkadot, new CacheClient(cacheServerPort, Network.Polkadot))
    cache.set(Network.Kusama, new CacheClient(cacheServerPort, Network.Kusama))

    const db = new DB(connectionString)

    console.log("connect to db...")
    await db.connect()
    console.log("end of connect to db")

    actionHandler = new ActionHandler(client, apiPolkadot, apiKusama, cache.get(Network.Polkadot)!, cache.get(Network.Kusama)!, db)
    const scheduler = new Scheduler(cache.get(Network.Polkadot)!, cache.get(Network.Kusama)!, db, actionHandler)

    console.log("init blockchain info...")

    let isInit = false
    while (!isInit) {
        const polkadotCache = cache.get(Network.Polkadot)!
        const kusamaCache = cache.get(Network.Kusama)!

        console.log("init cache")

        try {
            await polkadotCache.updateCache()
            await kusamaCache.updateCache()

            await actionHandler.init()

            isInit = true
        } catch (e) {
            console.log("wait init cache")
        }

        await new Promise(resolve => setTimeout(resolve, 5 * Const.Sec));
    }

    console.log("end of init blockchain info")

    console.log("fractapp authorization...")
    await client.auth(seed)
    console.log("fractapp authorization: Success")

    setInterval(async () => {
        console.log("start scheduler")
        await scheduler.call()
        console.log("end of scheduler")
    }, Const.SchedulerTimeout)

    console.log("start app...")
    const usersPromise: Map<string, Promise<void>> = new Map<string, Promise<void>>()

    while (true) {
        try {
            const newMsgs = await client.getUnreadMessages()

            for (const msg of newMsgs.messages) {
                console.log("msg id: " + msg.id)
                console.log("msg: " + JSON.stringify(msg))

                if (!usersPromise.has(msg.sender)) {
                    try {
                        const p = action(msg, newMsgs.users[msg.sender]).finally(() => usersPromise.delete(msg.sender))
                        usersPromise.set(msg.sender, p)
                    } catch (e) {
                        usersPromise.delete(msg.sender)
                        console.log("Error: " + e)
                    }
                }
            }
        } catch (e) {
            console.log("Error: " + e)
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function getApiInstance(wssUrl: string): Promise<ApiPromise> {
    const wsProvider = new WsProvider(wssUrl);
    return await ApiPromise.create({provider: wsProvider})
}

async function action(msg: Message, user: Profile) {
    //TODO: error count for msg
    try {
        switch (msg.action) {
            case DefaultMsgAction.Init:
                await actionHandler.initMsg(msg, user)
                break
            case MsgAction.ChooseNewDeposit:
                await actionHandler.chooseNewDeposit(msg, user)
                break
            case MsgAction.Enter:
                await actionHandler.enter(toCurrency(msg.args.currency), Number(msg.args.action), msg.sender, user)
                break
            case MsgAction.ChooseWithdraw:
                await actionHandler.chooseWithdraw(msg)
                break
            case MsgAction.Confirm:
                await actionHandler.confirm(msg, user)
                break
            case MsgAction.SuccessTx:
                await actionHandler.successTx(msg)
                break
            case MsgAction.ErrorTx:
                await actionHandler.errorTx(msg)
                break
            case DefaultMsgAction.WalletButtonIn:
            case MsgAction.MyDeposits:
                await actionHandler.myDeposits(msg, user)
                break
            case DefaultMsgAction.WalletButtonOut:
            case MsgAction.WithdrawRequests:
                await actionHandler.withdrawRequests(msg, user)
                break
            default:
                await actionHandler.initMsg(msg, user)
        }
    } catch (e) {
        await actionHandler.initMsg(msg, user)
    }
    await client.setRead([msg.id])
    console.log("Success: (msgId)" + msg.id)
}

start()
