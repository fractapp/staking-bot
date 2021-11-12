import {DefaultMsgAction, Message, Profile, Row} from "../types/api";
import {Action, Currency, fromCurrency, getNativeCurrency, getNetwork, Network, toCurrency} from "../types/enums";
import {ApiPromise} from "@polkadot/api";
import {FractappClient} from "../fractapp/client";
import {TxBuilder} from "../utils/txBuilder";
import {MathUtil} from "../utils/math";
import BN from "bn.js";
import {UnsignedTransaction} from "@substrate/txwrapper-polkadot";
import {MessageCreator} from "./messageCreator";
import {DB} from "../db/db";
import {CacheClient} from "../utils/cacheClient";

export enum MsgAction {
    ChooseNewDeposit = "chooseNewDeposit",
    WithdrawRequests = "withdrawRequests",
    MyDeposits = "myDeposits",
    Enter = "enter",
    ChooseWithdraw = "chooseWithdraw",
    Confirm = "confirm",
    SuccessTx = "successTx",
    ErrorTx = "errorTx"
}

export class ActionHandler {
    private client: FractappClient
    private apiByNetwork = new  Map<Network, ApiPromise>()
    private messageCreatorByNetwork = new  Map<Network, MessageCreator>()
    private txBuilderByNetwork = new  Map<Network, TxBuilder>()
    private cacheByNetwork = new  Map<Network, CacheClient>()
    private db: DB

    constructor(client: FractappClient, polkadotApi: ApiPromise, kusamaApi: ApiPromise, polkadotCache: CacheClient, kusamaCache: CacheClient, db: DB) {
        this.apiByNetwork.set(Network.Polkadot, polkadotApi)
        this.apiByNetwork.set(Network.Kusama, kusamaApi)

        this.cacheByNetwork.set(Network.Polkadot, polkadotCache)
        this.cacheByNetwork.set(Network.Kusama, kusamaCache)

        this.txBuilderByNetwork.set(Network.Polkadot, new TxBuilder(polkadotApi, polkadotCache, Network.Polkadot))
        this.txBuilderByNetwork.set(Network.Kusama, new TxBuilder(kusamaApi, kusamaCache, Network.Kusama))

        this.messageCreatorByNetwork.set(Network.Polkadot, new MessageCreator(polkadotCache, Network.Polkadot, Currency.DOT))
        this.messageCreatorByNetwork.set(Network.Kusama, new MessageCreator(kusamaCache, Network.Kusama, Currency.KSM))

        this.db = db
        this.client = client
    }

    public async init(): Promise<void> {
        await this.txBuilderByNetwork.get(Network.Polkadot)!.init()
        await this.txBuilderByNetwork.get(Network.Kusama)!.init()
    }

    public async initMsg(msg: Message, user: Profile) {
        const stakingInfoPolkadot = await this.cacheByNetwork.get(Network.Polkadot)!.getStakingInfo()
        const stakingInfoKusama = await this.cacheByNetwork.get(Network.Kusama)!.getStakingInfo()

        const dotAPY = stakingInfoPolkadot.averageAPY
        const ksmAPY = stakingInfoKusama.averageAPY

        const min = dotAPY < ksmAPY ? dotAPY : ksmAPY
        const max = dotAPY > ksmAPY ? dotAPY : ksmAPY

        const polkadotDeposit = await this.messageCreatorByNetwork.get(Network.Polkadot)!.getDeposit(user)
        const kusamaDeposit = await this.messageCreatorByNetwork.get(Network.Kusama)!.getDeposit(user)

        const isDepositExist = polkadotDeposit.value != null || kusamaDeposit.value != null

        let warns = (polkadotDeposit.isWarnExist ? 1 : 0) + (kusamaDeposit.isWarnExist ? 1 : 0)
        const rows: Array<Row> = [
            {
                buttons: [
                    {
                        value: "Open deposit",
                        action: MsgAction.ChooseNewDeposit,
                        arguments: {},
                        imageUrl: null
                    },
                    {
                        value: "Info",
                        action: DefaultMsgAction.OpenUrl,
                        arguments: {
                            link: "https://wiki.polkadot.network/ru-RU/docs/learn-staking"
                        },
                        imageUrl: null
                    },
                ]
            },
        ]
        if (isDepositExist) {
            rows.push({
                buttons: [
                    {
                        value: "My deposits",
                        action: MsgAction.MyDeposits,
                        arguments: {},
                        imageUrl: null
                    }
                ]
            })
        }

        if (!(await this.db.hasUser(user.id))) {
            await this.db.setUser(user.id, user.addresses)
        }

        await this.client.sendMsg({
            version: 1,
            value: `Hi!\nYou can open a staking deposit for DOT or KSM and receive from ${min}% to ${max}% per annum!` +
                (isDepositExist ? "\n\nAlso, you have already opened deposits." : "") +
                (warns != 0 ? (`\n\nYour ${warns == 1 ? 'deposit is inactive' : 'deposits are inactive'} because it is below the minimum amount.`) : ""),
            action: "",
            receiver: msg.sender,
            args: {},
            rows: rows
        })
    }

    public async chooseNewDeposit(msg: Message, user: Profile) {
        let value =  `Deposits information:`
        const rows = []
        for (let currency of [ Currency.DOT, Currency.KSM]) {
            value += '\n\n'
            const color = currency == Currency.DOT ? '🔴' : '🔵'
            const newDepositInfo = await this.messageCreatorByNetwork.get(getNetwork(currency))!.getNewDeposit(user)
            rows.push({
                buttons: [
                    {
                        value: newDepositInfo.hasOpenedDeposit ? `${color} Add amount to ${fromCurrency(currency)} deposit` : `${color} Open ${fromCurrency(currency)} deposit`,
                        action: MsgAction.Enter,
                        arguments: {
                            currency: fromCurrency(currency),
                            action: newDepositInfo.hasOpenedDeposit ? String(Action.AddAmount) : String(Action.Open),
                        },
                        imageUrl: null
                    }
                ]
            })

           value += newDepositInfo.value
        }

        await this.client.sendMsg({
            version: 1,
            value: value,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: rows
        })
    }

    public async myDeposits(msg: Message, user: Profile) {
        const polkadotDeposit = await this.messageCreatorByNetwork.get(Network.Polkadot)!.getDeposit(user)
        const kusamaDeposit = await this.messageCreatorByNetwork.get(Network.Kusama)!.getDeposit(user)

        const value = `Your deposits: \n\n` + (
            (polkadotDeposit.value != null ?
                polkadotDeposit.value + "\n\n"
                : "") +
            (kusamaDeposit.value != null ?
                kusamaDeposit.value + "\n\n"
                : "")
        )

        const rows: Array<Row> = []

        if (polkadotDeposit.hasActiveAmount || kusamaDeposit.hasActiveAmount) {
            const isAllActiveDeposits = polkadotDeposit.hasActiveAmount && kusamaDeposit.hasActiveAmount
            const activeAmountCurrency = polkadotDeposit.hasActiveAmount ? Currency.DOT : Currency.KSM
            rows.push({
                buttons: [{
                    value: `Create a withdrawal request`,
                    action: polkadotDeposit.hasActiveAmount && kusamaDeposit.hasActiveAmount ? MsgAction.ChooseWithdraw : MsgAction.Enter,
                    arguments: isAllActiveDeposits ? {} : {
                        currency: fromCurrency(activeAmountCurrency),
                        action: String(Action.CreateWithdrawRq)
                    },
                    imageUrl: null
                }]
            })
        }

        const existDepositCurrency = polkadotDeposit.value != null ? Currency.DOT : Currency.KSM
        const isAllDepositsExist = polkadotDeposit.value != null && kusamaDeposit.value != null
        rows.push({
            buttons: [{
                value: `Add amount`,
                action: isAllDepositsExist ? MsgAction.ChooseNewDeposit : MsgAction.Enter,
                arguments: isAllDepositsExist ? {} : {
                    currency: fromCurrency(existDepositCurrency),
                    action: String(Action.AddAmount)
                },
                imageUrl: null
            }]
        })

        if (polkadotDeposit.hasWithdrawRequest || kusamaDeposit.hasWithdrawRequest) {
            rows.push({
                buttons: [{
                    value: `Withdrawal requests`,
                    action: MsgAction.WithdrawRequests,
                    arguments: {},
                    imageUrl: null
                }]
            })
        }

        rows.push({
            buttons: [{
                value: `Back`,
                action: DefaultMsgAction.Init,
                arguments: {},
                imageUrl: null
            }]
        })

        await this.client.sendMsg({
            version: 1,
            value: value,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: rows
        })
    }

    public async withdrawRequests(msg: Message, user: Profile) {
        const polkadotWithdrawRequests = await this.messageCreatorByNetwork.get(Network.Polkadot)!.getWithdrawRequests(user)
        const kusamaWithdrawRequests = await this.messageCreatorByNetwork.get(Network.Kusama)!.getWithdrawRequests(user)

        let value = `Your withdrawal requests: \n\n`

        value += polkadotWithdrawRequests.value != null ? polkadotWithdrawRequests.value : ''
        value += kusamaWithdrawRequests.value != null ? '\n' + kusamaWithdrawRequests.value : ''

        const row: Array<Row> = []
        for (const button of polkadotWithdrawRequests.buttons.concat(kusamaWithdrawRequests.buttons)) {
            row.push({
                buttons: [
                    button
                ]
            })
        }

        row.push(
            {
                buttons: [
                    {
                        value: `Back`,
                        action: MsgAction.MyDeposits,
                        arguments: {},
                        imageUrl: null
                    }
                ]
            }
        )

        await this.client.sendMsg({
            version: 1,
            value: value,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: row
        })
    }

    public async chooseWithdraw(msg: Message) {
        const buttons = []
        for (let currency of [Currency.DOT, Currency.KSM]) {
            const color = currency == Currency.DOT ? '🔴' : '🔵'
            buttons.push({
                value: `${color} ${fromCurrency(currency)}`,
                action: MsgAction.Enter,
                arguments: {
                    currency: fromCurrency(currency),
                    action: String(Action.CreateWithdrawRq)
                },
                imageUrl: null
            })
        }

        await this.client.sendMsg({
            version: 1,
            value: "Please, choose deposit for withdraw: ",
            action: "",
            receiver: msg.sender,
            args: {},
            rows: [
                {
                    buttons: buttons
                }
            ]
        })
    }

    public async enter(currency: Currency, action: Action, sender: string, user: Profile, error: string = '') {
        const network: Network = getNetwork(currency)

        const api = this.apiByNetwork.get(network)!
        const info = await this.cacheByNetwork.get(network)!.getStakingInfo()
        const stakingInfo = await this.cacheByNetwork.get(network)!.getUsersStaking()
        const txBuilder = this.txBuilderByNetwork.get(network)!


        console.log("start: " + new Date())
        let limit = null
        let unsignedTx: UnsignedTransaction | null = null
        switch (action) {
            case Action.AddAmount:
            case Action.Open:
                unsignedTx = await txBuilder.bound(user.addresses[network], info.minStakingAmountPlanks.toString())
                break
            case Action.CreateWithdrawRq:
                const userStaking = stakingInfo[user.addresses[currency]]!
                limit = userStaking.active.toString()
                unsignedTx = await txBuilder.withdraw(user.addresses[network], info.minStakingAmountPlanks.toString(), true)
                break
        }

        console.log("#2: " + new Date())
        const hexTx = await txBuilder.fakeSign(unsignedTx!)
        console.log("#3: " + new Date())
        const fee = await api.rpc.payment.queryInfo(hexTx)
        console.log("#4: " + new Date())
        console.log("fee: " + fee.partialFee.toBn().toString())

        let msg = ""
        switch (action) {
            case Action.Open:
                msg = `Enter the amount for the deposit`
                break
            case Action.AddAmount:
                msg = `Enter the amount`
                break
            case Action.CreateWithdrawRq:
                msg = `Enter the amount for the withdraw`
                break
        }

        await this.client.sendMsg({
            version: 1,
            value: error != '' ? error : msg,
            action: "",
            receiver: sender,
            args: {},
            rows: [
                {
                    buttons: [
                        {
                            value: `💵 Enter amount`,
                            action: DefaultMsgAction.EnterAmount,
                            arguments: {
                                limit: limit ?? '',
                                currency: fromCurrency(currency),
                                fee: fee.partialFee.toBn().toString(),
                                next: MsgAction.Confirm,
                                arguments: JSON.stringify({
                                    currency: fromCurrency(currency),
                                    action: String(action)
                                })
                            },
                            imageUrl: null
                        },
                        {
                            value: `✖️ Cancel`,
                            action: DefaultMsgAction.Init,
                            arguments: {},
                            imageUrl: null
                        }
                    ]
                }
            ]
        })
    }

    //TODO: balances and min amount
    public async confirm(msg: Message, user: Profile) {
        const value: string | undefined = msg.args.value
        const args = JSON.parse(msg.args.arguments)

        const action: Action = Number(args.action)
        const currency: Currency = toCurrency(args.currency)
        const network = getNetwork(currency)

        const txBuilder = this.txBuilderByNetwork.get(network)!

        const info = await this.cacheByNetwork.get(getNetwork(currency))!.getStakingInfo()

        let unsignedTx: UnsignedTransaction | null = null
        switch (action) {
            case Action.Open:
                const min = info.minStakingAmountPlanks
                if (BigInt(value!) < min) {
                    await this.enter(
                        currency,
                        Action.Open,
                        msg.sender,
                        user,
                        `Please, re-enter amount\nMinimum amount for deposit: ${MathUtil.convertFromPlanckToString(min, info.decimalsCount)} ${fromCurrency(currency)}`
                    )
                    return
                }
                unsignedTx = await txBuilder.bound(user.addresses[network], value)
                break
            case Action.CreateWithdrawRq:
                const stakingInfo = await this.cacheByNetwork.get(network)!.getUsersStaking()

                const userStaking = stakingInfo[user.addresses[network]]
                const stakingBalance = userStaking == undefined ? BigInt(0) : userStaking.active
                if (BigInt(value!) > stakingBalance) {
                    await this.enter(
                        currency,
                        Action.CreateWithdrawRq,
                        msg.sender,
                        user,
                        `Please, re-enter amount\nMax amount for withdraw: ${MathUtil.convertFromPlanckToString(stakingBalance, info.decimalsCount)} ${fromCurrency(currency)}`
                    )
                    return
                }
                unsignedTx = await txBuilder.withdraw(user.addresses[network], value, BigInt( value) == stakingBalance)
                break
            case Action.AddAmount:
                const account = await this.apiByNetwork.get(network)!.query.system.account(user.addresses[network]);
                const free = account.data.free.toBn()
                const miscFrozen = account.data.miscFrozen.toBn()

                const freeBalance = free.sub(miscFrozen)
                if (new BN(value!).cmp(freeBalance) > 0) {
                    await this.enter(
                        currency,
                        Action.CreateWithdrawRq,
                        msg.sender,
                        user,
                        `Please, re-enter amount\nInsufficient funds`
                    )
                    return
                }
                unsignedTx = await txBuilder.bound(user.addresses[network], value)
                break
            case Action.ConfirmWithdraw:
                unsignedTx = await txBuilder.confirmWithdraw(user.addresses[network], 0) //TODO: num
                break
            case Action.UpdateNominations:
                unsignedTx = await txBuilder.updateNominations(user.addresses[network])
                break
        }

        await this.client.sendMsg({
            version: 1,
            value: action == Action.UpdateNominations ? `Please, upgrade your settings to prevent per annum percent from falling.` : `Please, confirm transaction`,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: [
                {
                    buttons: [
                        {
                            value: action == Action.UpdateNominations ?  `✅️ Upgrade for ${fromCurrency(getNativeCurrency(network))} deposit` : `✅ Confirm`,
                            action: DefaultMsgAction.Broadcast,
                            arguments: {
                                unsignedTx:  JSON.stringify(unsignedTx),
                                currency: fromCurrency(currency),
                                success: MsgAction.SuccessTx,
                                error: MsgAction.ErrorTx
                            },
                            imageUrl: null
                        },
                        {
                            value: `✖️ Cancel`,
                            action: DefaultMsgAction.Init,
                            arguments: {},
                            imageUrl: null
                        }
                    ]
                }
            ]
        })
    }

    public async successTx(msg: Message) {
        await this.client.sendMsg({
            version: 1,
            value: `Wait for the confirmation of the transaction.`,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: [
                {
                    buttons: [
                        {
                            value: `↩️ Return to menu`,
                            action: DefaultMsgAction.Init,
                            arguments: {},
                            imageUrl: null
                        }
                    ]
                }
            ]
        })
    }

    public async errorTx(msg: Message) {
        await this.client.sendMsg({
            version: 1,
            value: `An error has occurred. Please, try again or contact with support: support@fractapp.com.`,
            action: "",
            receiver: msg.sender,
            args: {},
            rows: [
                {
                    buttons: [
                        {
                            value: `↩️ Try again`,
                            action: DefaultMsgAction.Init,
                            arguments: {},
                            imageUrl: null
                        }
                    ]
                }
            ]
        })
    }
}
