import {DB} from "./db";
import {Action, Currency, fromCurrency, getNativeCurrency, Network} from "./types/enums";
import {ApiPromise} from "@polkadot/api";
import {ActionHandler} from "./actions";
import {Message, Profile} from "./types/api";
import {Cache} from "./cache";
import {Const} from "./const";
import BN from "bn.js";


type StakingInfo = {
    total: BN,
    active: BN,
    hasWithdrawal: boolean,
    targets: Array<string>
}

export class Scheduler  {
    private apiByNetwork = new Map<Network, ApiPromise>()
    private cacheByNetwork = new Map<Network, Cache>()

    private db: DB
    private actionHandler: ActionHandler;

    constructor(
        apiPolkadot: ApiPromise, apiKusama: ApiPromise,
        cachePolkadot: Cache, cacheKusama: Cache,
        db: DB, actionHandler: ActionHandler
    ) {
        this.db = db
        this.apiByNetwork.set(Network.Polkadot, apiPolkadot)
        this.apiByNetwork.set(Network.Kusama, apiKusama)

        this.cacheByNetwork.set(Network.Polkadot, cachePolkadot)
        this.cacheByNetwork.set(Network.Kusama, cacheKusama)

        this.actionHandler = actionHandler
    }

    public async call() {
        console.log("start scheduler \n")

        const usersStakingInfoByNetwork = new Map<Network, Map<string, StakingInfo>>()
        usersStakingInfoByNetwork.set(Network.Polkadot, await this.getUsersStakingInfoByNetwork(Network.Polkadot))
        usersStakingInfoByNetwork.set(Network.Kusama, await this.getUsersStakingInfoByNetwork(Network.Kusama))

        const sentWithdrawRqByUsers = new Map<string, boolean>()
        const topValidators = this.cacheByNetwork.get(Network.Polkadot)!.getTopValidators()

        for (const network of [Network.Polkadot, Network.Kusama]) {
            console.log("start for: " + network)
            const currency = getNativeCurrency(network)
            const usersStakingInfo = usersStakingInfoByNetwork.get(network)!

            for (const address of usersStakingInfo.keys()) {
                console.log("address: " + address)
                const stakingInfo = usersStakingInfo.get(address)!
                try {
                    const userId = await this.db.getUserIdByAddress(currency, address)
                    if (userId == undefined) {
                        continue
                    }

                    const addresses: Record<Currency, string> = <Record<Currency, string>>{}
                    addresses[Currency.DOT] = (await this.db.getAddressesByUser(Currency.DOT, userId))!
                    addresses[Currency.KSM] = (await this.db.getAddressesByUser(Currency.KSM, userId))!

                    if (stakingInfo.total.cmp(stakingInfo.active) != 0 && stakingInfo.hasWithdrawal && !sentWithdrawRqByUsers.has(userId)) {
                        sentWithdrawRqByUsers.set(userId, true)

                        console.log(`send withdrawal request (${address}): ${userId}`)
                        await this.actionHandler.withdrawRequests(<Message>{
                            sender: userId,
                        }, <Profile>{
                            addresses: addresses
                        })
                    }

                    const topValidatorsMap = new Map<string, boolean>()
                    for (let validator of topValidators) {
                        topValidatorsMap.set(validator, true)
                    }

                    let count = 0
                    for (let nomination of stakingInfo.targets) {
                        if (topValidatorsMap.has(nomination)) {
                            count++
                        }
                    }

                    if (count / topValidators.length <= Const.ThresholdUserNominations) {
                        console.log(`send update nominations (${address}): ${userId}`)
                        const args: Record<string, string> = {
                            arguments: JSON.stringify({
                                action: String(Action.UpdateNominations),
                                currency: fromCurrency(currency)
                            })
                        }

                        await this.actionHandler.confirm(<Message>{
                            sender: userId,
                            args: args
                        }, <Profile>{
                            addresses: addresses
                        })
                    }
                } catch (e) {
                    console.log("Error: " + (e as Error).toString())
                }
            }
        }

        console.log("\nend of scheduler")
    }

    private async getUsersStakingInfoByNetwork(network: Network): Promise<Map<string, StakingInfo>> {
        const api = this.apiByNetwork.get(network)!

        const stakingInfoPromise = api.query.staking.ledger.entries()
        const targetsPromise = api.query.staking.nominators.entries()

        const stakingInfo = await stakingInfoPromise
        const activeEra = await api.query.staking.activeEra()

        const users = new Map<string, StakingInfo>()
        for (const staking of stakingInfo) {
            if (staking[0].args[0] == undefined) {
                continue
            }
            const address = staking[0].args[0].toHuman()
            const info = staking[1].isNone ? null : staking[1].unwrap()
            if (info == null) {
                continue
            }

            let hasWithdrawal = false
            for (let unlocking of info.unlocking) {
                const era = unlocking.era.unwrap().toNumber()
                const duration = era - activeEra.unwrap().index.toBn().toNumber()

                if (duration < 0) {
                    hasWithdrawal = true
                    break
                }
            }

            users.set(address, {
                total: info.total.toBn(),
                active: info.active.toBn(),
                hasWithdrawal: hasWithdrawal,
                targets: []
            })
        }

        const targets = await targetsPromise
        for (const target of targets) {
            const address = target[0].args[0].toHuman()
            const targetInfo = target[1].isNone ? null :  target[1].unwrap()
            if (targetInfo == null || targetInfo.targets.length == 0 || !users.has(address)) {
                continue
            }

            const stakingInfo = users.get(address)!

            const userTarget = []
            for (let validator of targetInfo.targets) {
                userTarget.push(validator.toHuman())
            }
            stakingInfo.targets = userTarget
        }

        return users
    }
}
