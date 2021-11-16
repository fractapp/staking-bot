import {DB} from "../db/db";
import {Action, fromCurrency, getNativeCurrency, Network} from "../types/enums";
import {ActionHandler} from "./actions";
import {Message, Profile} from "../types/api";
import {Const} from "../utils/const";
import {CacheClient} from "../utils/cacheClient";
import {UserStakingInfo} from "../cache/cache";

export class Scheduler  {
    private cacheByNetwork = new Map<Network, CacheClient>()

    private db: DB
    private actionHandler: ActionHandler;

    constructor(
        cachePolkadot: CacheClient,
        cacheKusama: CacheClient,
        db: DB,
        actionHandler: ActionHandler
    ) {
        this.db = db

        this.cacheByNetwork.set(Network.Polkadot, cachePolkadot)
        this.cacheByNetwork.set(Network.Kusama, cacheKusama)

        this.actionHandler = actionHandler
    }

    public async call() {
        const usersStakingInfoByNetwork = new Map<Network, Record<string, UserStakingInfo | undefined>>()
        usersStakingInfoByNetwork.set(Network.Polkadot, await this.cacheByNetwork.get(Network.Polkadot)!.getUsersStaking())
        usersStakingInfoByNetwork.set(Network.Kusama, await this.cacheByNetwork.get(Network.Kusama)!.getUsersStaking())

        const sentWithdrawRqByUsers = new Map<string, boolean>()

        const users = await this.db.getUsers()
        for (const user of users) {
            console.log("user: " + JSON.stringify(user))

            for (const network of [Network.Polkadot, Network.Kusama]) {
                const topValidators = await this.cacheByNetwork.get(network)!.getTopValidators()

                const currency = getNativeCurrency(network)
                const usersStakingInfo = usersStakingInfoByNetwork.get(network)!

                const address = user.addresses[network]
                const stakingInfo = usersStakingInfo[user.addresses[network]]
                if (stakingInfo == undefined) {
                    continue
                }

                try {
                    if (stakingInfo.total != stakingInfo.active && stakingInfo.hasWithdrawal && !sentWithdrawRqByUsers.has(user.userId)) {
                        sentWithdrawRqByUsers.set(user.userId, true)

                        console.log(`send withdrawal request (${address}): ${user.userId}`)
                        await this.actionHandler.withdrawRequests(<Message>{
                            sender: user.userId,
                        }, <Profile>{
                            addresses: user.addresses
                        })
                    }

                    const topValidatorsMap = new Map<string, boolean>()
                    for (let validator of topValidators) {
                        topValidatorsMap.set(validator, true)
                    }

                    if (stakingInfo.active == 0n) {
                        continue
                    }

                    let count = 0
                    for (let nomination of stakingInfo.targets) {
                        if (topValidatorsMap.has(nomination)) {
                            count++
                        }
                    }

                    if (
                        (count < topValidators.length && topValidators.length/count >  Const.ThresholdUserNominations) ||
                        (count / topValidators.length <= Const.ThresholdUserNominations)
                    ) {
                        console.log(`send update nominations (${address}): ${user.userId}`)
                        const args: Record<string, string> = {
                            arguments: JSON.stringify({
                                action: String(Action.UpdateNominations),
                                currency: fromCurrency(currency)
                            })
                        }

                        await this.actionHandler.confirm(<Message>{
                            sender: user.userId,
                            args: args
                        }, <Profile>{
                            addresses: user.addresses
                        })
                    }
                } catch (e) {
                    console.log("Error: " + (e as Error).toString())
                }
            }
        }
    }
}
