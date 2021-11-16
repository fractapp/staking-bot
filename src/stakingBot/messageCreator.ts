import {Button, Profile} from "../types/api";
import {Action, Currency, fromCurrency, MsgAction, Network} from "../types/enums";
import {MathUtil} from "../utils/math";
import {Const} from "../utils/const";
import {CacheClient} from "../utils/cacheClient";

export type DepositInfo = {
    value: string | null,
    hasWithdrawRequest: boolean,
    hasActiveAmount: boolean,
    isWarnExist: boolean
}

export type NewDepositInfo = {
    value: string,
    hasOpenedDeposit: boolean
}

export type WithdrawRequestsInfo = {
    value: string | null,
    totalWithdrawPlanks: bigint,
    buttons: Array<Button>
}

export class MessageCreator {
    private readonly cache: CacheClient
    private readonly network: Network
    private readonly currency: Currency

    constructor(cache: CacheClient, network: Network, currency: Currency) {
        this.cache = cache
        this.network = network
        this.currency = currency
    }

    public async warning(activeAmount: bigint): Promise<string | null> {
        const cacheInfo = await this.cache.getStakingInfo()

        if (activeAmount < cacheInfo.minStakingAmountPlanks) {
            const minAmount = MathUtil.convertFromPlanckToString(cacheInfo.minStakingAmountPlanks, cacheInfo.decimalsCount)
            return `\n\nThe ${fromCurrency(this.currency)} deposit is not active. The deposit must have more than the minimum amount of ${minAmount} ${fromCurrency(this.currency)}!`
        }

        return null
    }

    public async getNewDeposit(user: Profile): Promise<NewDepositInfo> {
        const info = await this.cache.getStakingInfo()
        const usersStaking = await this.cache.getUsersStaking()
        const min = Number(info.minStakingAmountPlanks * Const.Accuracy / info.decimals) / Number(Const.Accuracy)
        const staking = usersStaking[user.addresses[this.currency]]
        const stakingInfo = staking == undefined ? null : staking

        const value =
            (this.currency == Currency.KSM ? '🔵KSM Deposit🔵\n' : '🔴DOT Deposit🔴\n') +
            `Annual yield: ${info.averageAPY}%\n` +
            `Withdrawal duration: ${info.unbondingPeriod} days \n` +
            `Minimum amount: ${min} ${fromCurrency(this.currency)}`

        return {
            value: value,
            hasOpenedDeposit: stakingInfo != null && stakingInfo.total != 0n
        }
    }

    public async getDeposit(user: Profile): Promise<DepositInfo> {
        const cacheInfo = await this.cache.getStakingInfo()
        const usersStaking = await this.cache.getUsersStaking()

        const staking = usersStaking[user.addresses[this.currency]]
        const stakingInfo = staking == undefined ? null : staking

        let value = null
        let isWarnExist = false
        if (stakingInfo != null && stakingInfo.total != 0n) {
            const warn = await this.warning(stakingInfo.active)
            if (warn != null) {
                isWarnExist = true
            }

            value = (this.currency == Currency.KSM ? '🔵KSM Deposit🔵\n' : '🔴DOT Deposit🔴\n') +
                `Total withdrawal request: ${stakingInfo!.unlocking.length}\n` +
                `Active deposit amount: ${MathUtil.convertFromPlanckToString(stakingInfo!.active, cacheInfo.decimalsCount)} ${fromCurrency(this.currency)}\n` +
                `Withdrawal amount: ${MathUtil.convertFromPlanckToString(stakingInfo!.total - stakingInfo!.active, cacheInfo.decimalsCount)} ${fromCurrency(this.currency)}` +
                (warn ?? "")
        }

        return {
            value: value,
            hasWithdrawRequest: stakingInfo != null && stakingInfo!.unlocking.length > 0,
            hasActiveAmount: stakingInfo != null && stakingInfo!.active > 0,
            isWarnExist: isWarnExist
        }
    }

    public async getWithdrawRequests(user: Profile): Promise<WithdrawRequestsInfo> {
        const info = await this.cache.getStakingInfo()
        const usersStaking = await this.cache.getUsersStaking()

        const staking = usersStaking[user.addresses[this.currency]]
        const stakingInfo = staking == undefined ? null : staking

        const buttons = []
        let totalWithdrawPlanks = 0n
        let withdrawRequestText = ""
        if (stakingInfo != null && stakingInfo.unlocking.length > 0) {
            const activeEra = info.activeEra

            withdrawRequestText = this.currency == Currency.DOT ? `🔴DOT requests🔴\n\n` : `🔵KSM requests🔵\n\n`

            let isExistNotActiveWR = false
            for (let unlocking of stakingInfo.unlocking) {
                const planksValue = unlocking.value
                const amount = MathUtil.convertFromPlanckToString(planksValue, info.decimalsCount)
                const duration = unlocking.era - activeEra
                const time = Math.floor(duration * info.eraDuration) / 24

                if (time < 0) {
                    totalWithdrawPlanks += planksValue
                } else {
                    if (!isExistNotActiveWR) {
                        isExistNotActiveWR = true
                    }
                    withdrawRequestText += `${amount} ${fromCurrency(this.currency)} unlocked after ${time} days\n`
                }
            }

            if (!isExistNotActiveWR) {
                withdrawRequestText = await this.warning(stakingInfo.active) ?? ""
            } else {
                withdrawRequestText += await this.warning(stakingInfo.active) ?? ""
            }
        }

        let value: string | null = null
        if (withdrawRequestText) {
            value = withdrawRequestText
        }

        if (totalWithdrawPlanks > 0n) {
            const withdrawText = `${MathUtil.convertFromPlanckToString(totalWithdrawPlanks, info.decimalsCount)} ${fromCurrency(this.currency)}`
            value += `\n\nYou can withdraw ${withdrawText}`
            buttons.push({
                value: `Withdraw ${withdrawText}`,
                action: MsgAction.Confirm,
                arguments: {
                    arguments: JSON.stringify({
                        currency: fromCurrency(this.currency),
                        action: String(Action.ConfirmWithdraw)
                    })
                },
                imageUrl: null
            })
        }

        if (stakingInfo != null && stakingInfo.active > 0n) {
            buttons.push({
                value: `Create withdraw request for ${fromCurrency(this.currency)}`,
                action: MsgAction.Enter,
                arguments: {
                    currency: fromCurrency(this.currency),
                    action: String(Action.CreateWithdrawRq)
                },
                imageUrl: null
            })
        }

        return {
            value: value,
            totalWithdrawPlanks: totalWithdrawPlanks,
            buttons: buttons,
        }
    }
}
