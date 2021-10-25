import {Button, Message, Profile} from "./types/api";
import {Action, Currency, fromCurrency, Network} from "./types/enums";
import {MathUtil} from "./math";
import {ApiPromise} from "@polkadot/api";
import {Cache} from "./cache";
import {Const} from "./const";
import {MsgAction} from "./actions";
import BN from "bn.js";

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
    totalWithdrawPlanks: BN,
    buttons: Array<Button>
}

export class MessageCreator {
    private readonly api: ApiPromise
    private readonly cache: Cache
    private readonly network: Network
    private readonly currency: Currency

    constructor(api: ApiPromise, cache: Cache, network: Network, currency: Currency) {
        this.api = api
        this.cache = cache
        this.network = network
        this.currency = currency
    }

    public warning(activeAmount: BN): string | null {
        const cacheInfo = this.cache.getStakingInfo()
        const amount = MathUtil.convertFromPlanckToString(cacheInfo.minStakingAmountPlanks, cacheInfo.decimalsCount)

        if (activeAmount.cmp(cacheInfo.minStakingAmountPlanks) < 0) {
            return `\n\nThe $${fromCurrency(this.currency)} deposit is not active. The deposit must have more than the minimum amount of ${amount} ${fromCurrency(this.currency)}!`
        }

        return null
    }
    public async getNewDeposit(user: Profile): Promise<NewDepositInfo> {
        const info = this.cache.getStakingInfo()
        const min = info.minStakingAmountPlanks.mul(Const.Accuracy).div(info.decimals).toNumber() / Const.Accuracy.toNumber()
        const staking = await this.api.query.staking.ledger(user.addresses[this.currency])
        const stakingInfo = staking.isNone ? null : staking.unwrap()

        const value =
            (this.currency == Currency.KSM ? '🔵KSM Deposit🔵\n' : '🔴DOT Deposit🔴\n') +
            `Annual yield: ${info.averageAPY}%\n` +
            `Withdrawal duration: ${info.unbondingPeriod} days \n` +
            `Minimum amount: ${min} ${fromCurrency(this.currency)}`

        return {
            value: value,
            hasOpenedDeposit: stakingInfo != null && stakingInfo.total.toBn().cmp(new BN(0)) != 0
        }
    }

    public async getDeposit(user: Profile): Promise<DepositInfo> {
        const staking = await this.api.query.staking.ledger(user.addresses[this.currency])
        const cacheInfo = this.cache.getStakingInfo()

        const stakingInfo = staking.isNone ? null : staking.unwrap()

        let value = null
        let isWarnExist = false
        if (stakingInfo != null && stakingInfo.total.toBn().cmp(new BN(0)) != 0) {
            const warn = this.warning(stakingInfo.active.toBn())
            if (warn != null) {
                isWarnExist = true
            }

            value =   (this.currency == Currency.KSM ? '🔵KSM Deposit🔵\n' : '🔴DOT Deposit🔴\n') +
                `Withdrawal requests: ${stakingInfo!.unlocking.length}\n` +
                `Active amount: ${MathUtil.convertFromPlanckToString(stakingInfo!.active.toBn(), cacheInfo.decimalsCount)} ${fromCurrency(this.currency)}\n` +
                `Withdrawal amount: ${MathUtil.convertFromPlanckToString(stakingInfo!.total.toBn().sub(stakingInfo!.active.toBn()), cacheInfo.decimalsCount)} ${fromCurrency(this.currency)}` +
                (warn ?? "")
        }

        return {
            value: value,
            hasWithdrawRequest: stakingInfo != null && stakingInfo!.unlocking.length > 0,
            hasActiveAmount: stakingInfo != null && stakingInfo!.active.toBn().cmp(new BN(0)) > 0,
            isWarnExist: isWarnExist
        }
    }

    public async getWithdrawRequests(user: Profile): Promise<WithdrawRequestsInfo> {
        const staking = await this.api.query.staking.ledger(user.addresses[this.currency])

        const info = this.cache.getStakingInfo()
        const stakingInfo = staking.isNone ? null : staking.unwrap()

        const buttons = []
        let totalWithdrawPlanks = new BN(0)
        let withdrawRequestText = ""
        if (stakingInfo != null && stakingInfo.unlocking.length > 0) {
            const activeEra = await this.api.query.staking.activeEra()

            withdrawRequestText = this.currency == Currency.DOT ? `🔴DOT requests🔴\n\n` : `🔵KSM requests🔵\n\n`

            let isExistNotActiveWR = false
            for (let unlocking of stakingInfo.unlocking) {
                const planksValue = unlocking.value.unwrap().toBn()
                const amount = MathUtil.convertFromPlanckToString(planksValue, info.decimalsCount)
                const era = unlocking.era.unwrap().toNumber()
                const duration = era - activeEra.unwrap().index.toBn().toNumber()
                const time = Math.floor(duration * info.eraDuration) / 24

                if (time < 0) {
                    totalWithdrawPlanks = totalWithdrawPlanks.add(planksValue)
                } else {
                    if (!isExistNotActiveWR) {
                        isExistNotActiveWR = true
                    }
                    withdrawRequestText += `${amount} ${fromCurrency(this.currency)} unlocked after ${time} days\n`
                }
            }

            if (!isExistNotActiveWR) {
                withdrawRequestText = this.warning(stakingInfo.active.toBn()) ?? ""
            } else {
                withdrawRequestText += this.warning(stakingInfo.active.toBn()) ?? ""
            }
        }

        let value: string | null = null
        if (withdrawRequestText) {
            value = withdrawRequestText
        }

        if (totalWithdrawPlanks.cmp(new BN(0)) > 0) {
            const withdrawText = `${MathUtil.convertFromPlanckToString(totalWithdrawPlanks, info.decimalsCount)} ${fromCurrency(this.currency)}`
            value += `\nYou can withdraw ${withdrawText}`
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

        if (stakingInfo != null && stakingInfo.active.toBn().cmp(new BN(0)) > 0) {
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
