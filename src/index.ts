import {DefaultMsgAction, Message, Profile} from "./types/api";
import {Action, Network, toCurrency} from "./types/enums";
import {ApiPromise, WsProvider} from "@polkadot/api";
import dotenv from "dotenv";
import {ActionHandler, MsgAction} from "./actions";
import {Cache} from "./cache";
import {Const} from "./const";
import {FractappClient} from "./api";
import Keyv from 'keyv';
import {DB} from "./db";
import {Scheduler} from "./scheduler";

dotenv.config()

const client = new FractappClient()
let actionHandler: ActionHandler

let cache: Map<Network, Cache> = new Map<Network, Cache>()

async function start() {
    const connectionString = process.env["MONGODB_CONNECTION"] as string
    const keyv = new Keyv(connectionString);

    const seed = process.env["SEED"] as string
    const apiPolkadot = await getApiInstance(process.env["POLKADOT_RPC_URL"] as string)
    const apiKusama = await getApiInstance(process.env["KUSAMA_RPC_URL"] as string)

    cache.set(Network.Polkadot, new Cache(apiPolkadot))
    cache.set(Network.Kusama, new Cache(apiKusama))

    const db = new DB(keyv)
    actionHandler = new ActionHandler(client, apiPolkadot, apiKusama, cache.get(Network.Polkadot)!, cache.get(Network.Kusama)!, db)

    const scheduler = new Scheduler(apiPolkadot, apiKusama, cache.get(Network.Polkadot)!, cache.get(Network.Kusama)!, db, actionHandler)

    console.log("init blockchain info...")

    await updateStakingInfo()
    await updateValidators()

    console.log("end of init blockchain info")

    console.log("fractapp authorization...")
    await client.auth(seed)
    console.log("fractapp authorization: Success")

    setTimeout(async () => {
        await scheduler.call()
    }, Const.SchedulerTimeout)

    setTimeout(async () => {
        try {
            console.log("start of update staking info...")
            await updateStakingInfo()
            console.log("end of update staking info")
        } catch (e) {
            console.log("error update staking: " + e)
        }
    }, Const.StakingInfoUpdateTimeout)

    setTimeout(async () => {
        try {
            console.log("start of validators cache...")
            await updateValidators()
            console.log("end of validators cache")
        } catch (e) {
            console.log("error update validators: " + e)
        }
    }, Const.ValidatorsUpdateTimeout)

    console.log("start app...")
    while (true) {
        try {
            const newMsgs = await client.getUnreadMessages()

            const promises: Array<Promise<void>> = []
            for (const msg of newMsgs.messages) {
                console.log("msg id: " + msg.id)
                console.log("msg: " + JSON.stringify(msg))

                try {
                    promises.push(action(msg, newMsgs.users[msg.sender]))
                } catch (e) {
                    console.log("Error: " + e)
                }
            }

            for (const promise of promises) {
                await promise
            }
            console.log("Sleep 1 seconds")
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

async function updateStakingInfo(): Promise<[void, void]> {
    return Promise.all([
        cache.get(Network.Polkadot)!.updateStakingInfo(),
        cache.get(Network.Kusama)!.updateStakingInfo()
    ])
}

async function updateValidators(): Promise<[void, void]> {
    return Promise.all([
        cache.get(Network.Polkadot)!.updateValidators(),
        cache.get(Network.Kusama)!.updateValidators()
    ])
}

async function action(msg: Message, user: Profile) {
    //TODO: error count for msg
    try {
        switch (msg.action) {
            case DefaultMsgAction.Init:
                await actionHandler.init(msg, user)
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
                await actionHandler.init(msg, user)
        }
    } catch (e) {
        await actionHandler.init(msg, user)
    }
    await client.setRead([msg.id])
}

start()
