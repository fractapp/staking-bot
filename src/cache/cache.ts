import {ConstantsInfo, StakingInfo, ValidatorInfo} from "../types/staking";
import {ApiPromise} from "@polkadot/api";
import BN from "bn.js";
import {Const} from "../utils/const";
import * as polkaTypes from "@polkadot/types/interfaces/system/types";

type Unlock = {
    value: bigint,
    era: number
}
export type UserStakingInfo = {
    total: bigint,
    active: bigint,
    hasWithdrawal: boolean,
    targets: Array<string>,
    unlocking: Array<Unlock>
}

export class Cache {
    private api: ApiPromise
    private validators: Record<string, ValidatorInfo> = <Record<string, ValidatorInfo>>{}
    private topValidators: Array<string> = []
    private stakingInfo: StakingInfo | null = null
    private constants: ConstantsInfo | null = null
    private usersStaking: Record<string, UserStakingInfo | undefined> = {}

    private static _isExFailed(event: polkaTypes.Event): boolean {
        return (event.section == 'system' && event.method == 'ExtrinsicFailed')
    }

    constructor(api: ApiPromise) {
        this.api = api
    }

    private async getConstants(): Promise<ConstantsInfo> {
        if (this.constants == null) {
            const maxNominationsPromise = (this.api.consts.staking.maxNominations)
            const maxNominatorRewardedPerValidatorPromise = (this.api.consts.staking.maxNominatorRewardedPerValidator)
            const expectedBlockTimePromise = this.api.consts.babe.expectedBlockTime
            const epochDurationPromise = this.api.consts.babe.epochDuration
            const bondingDurationPromise = this.api.consts.staking.bondingDuration

            const maxNominations = (await maxNominationsPromise).toNumber()
            const maxNominatorRewardedPerValidator = (await maxNominatorRewardedPerValidatorPromise).toNumber()
            const expectedBlockTime = (await expectedBlockTimePromise).toNumber()
            const epochDuration = (await epochDurationPromise).toNumber()
            const bondingDuration = (await bondingDurationPromise).toNumber()

            this.constants = {
                MaxNominations: maxNominations,
                MaxNominatorRewardedPerValidator: maxNominatorRewardedPerValidator,
                ExpectedBlockTime: expectedBlockTime,
                EpochDuration: epochDuration,
                BondingDuration: bondingDuration
            }
        }

        return this.constants
    }

    private async updateStakingInfo(activeEra: number | undefined = undefined) {
        if (activeEra == undefined) {
            activeEra = (await this.api.query.staking.activeEra()).unwrap().index.toBn().toNumber()
        }

        const constantsPromise = this.getConstants()
        const maxSystemNominatorsCountPromise = this.api.query.staking.maxNominatorsCount()
        const nowNominatorsCountPromise = this.api.query.staking.counterForNominators()
        const chainInfoPromise = this.api.registry.getChainProperties()

        const minStakingAmountPromise = this.api.query.staking.minNominatorBond()

        const maxSystemNominatorsCount =  Number(await maxSystemNominatorsCountPromise)
        const nowNominatorsCount =  Number(await nowNominatorsCountPromise)
        const chainInfo = await chainInfoPromise

        const totalsPromise = this.api.query.staking.erasTotalStake.entries()
        const rewardsPromise = this.api.query.staking.erasValidatorReward.entries()
        const totals = await totalsPromise
        const rewards = await rewardsPromise
        const decimalsCount = Number(chainInfo!.tokenDecimals.toHuman())
        const decimals = BigInt(10) ** BigInt(decimalsCount)

        const totalsByEra: Record<number, number> = {}
        for (const total of totals) {
            try {
                totalsByEra[Number(total[0].toHuman())] = Number(total[1].toBigInt()/decimals)
            } catch (e) {
                console.log("e: " + e)
            }
        }

        const apys: Record<number, number> = {}
        for (const reward of rewards) {
            const era = Number(reward[0].toHuman())
            apys[era] = Number(reward[1].unwrap().toBigInt()/decimals)/totalsByEra[era]
        }

        let avg = 0
        for (const era of Object.keys(apys)) {
            avg += apys[Number(era)]
        }
        avg /= Object.keys(apys).length

        const constants = await constantsPromise
        const eraDuration = constants.ExpectedBlockTime*constants.EpochDuration*6/1000/60/60
        avg = avg/eraDuration * 24

        const compoundInterest = Math.floor((Math.pow(1 + avg, 365) - 1) * 10000)/100

        const unbondingPeriod = eraDuration * constants.BondingDuration/24

        this.stakingInfo = {
            activeEra: activeEra,
            minStakingAmountPlanks: (await minStakingAmountPromise).toBigInt(),
            maxNominations: constants.MaxNominations,
            maxNominatorRewardedPerValidator: constants.MaxNominatorRewardedPerValidator,
            isAvailable: nowNominatorsCount >= maxSystemNominatorsCount,
            averageAPY: compoundInterest,
            decimalsCount: decimalsCount,
            decimals: decimals,
            eraDuration: eraDuration,
            unbondingPeriod: unbondingPeriod
        }
    }

    private async updateValidators(currentEra: number | undefined = undefined) {
        if (currentEra == undefined) {
            currentEra = Number(await this.api.query.staking.currentEra())
        }

        const validatorsInfoPromise = this.api.query.staking.validators.entries();

        const slashesPromise = this.api.query.staking.validatorSlashInEra.entries(currentEra)
        const stakesAmountPromise = this.api.query.staking.erasStakers.entries(currentEra);
        const superIdentitiesPromise = this.api.query.identity.superOf.entries()
        const identitiesByValidatorPromise = this.api.query.identity.identityOf.entries()

        const validatorsInfo = (await validatorsInfoPromise)
        const slashes = (await slashesPromise)
        const stakesAmount = (await stakesAmountPromise)
        const superIdentities = (await superIdentitiesPromise)
        const identities = (await identitiesByValidatorPromise)

        const validatorsInfoByValidator: Record<string, any> = {}
        for (const validator of validatorsInfo) {
            validatorsInfoByValidator[validator[0].args[0].toString()] = validator[1]
        }

        const slashesByValidator: Record<string, boolean> = {}
        for (const slash of slashes) {
            if (slash[1].isNone) {
                continue
            }
            slashesByValidator[slash[0].args[1].toString()] = !slash[1].isNone
        }

        const superIdentitiesByValidator: Record<string, string> = {}
        for (const superIdentity of superIdentities) {
            superIdentitiesByValidator[superIdentity[0].args[0].toString()] = superIdentity[1].unwrap()[0].toString()
        }
        const identitiesSizesByValidator: Record<string, number> = {}
        for (const identity of identities) {
            identitiesSizesByValidator[identity[0].args[0].toString()] = identity[1].unwrap().size
        }

        const newValidatorCache: Record<string, ValidatorInfo> = {}
        for (const stakeAmount of stakesAmount) {
            const validator = stakeAmount[0].args[1].toString()
            const amount = stakeAmount[1]

            let identityAccount = validator
            if (superIdentitiesByValidator[validator]) {
                identityAccount = superIdentitiesByValidator[validator]
            }

            if (validatorsInfoByValidator[validator] == undefined) {
                continue
            }
            let isIdentity = identitiesSizesByValidator[identityAccount] > 2
            newValidatorCache[validator.toString()] = {
                ownStake: amount.own.toBn().toString(),
                totalStake: amount.total.toBn().toString(),
                commission: Number(validatorsInfoByValidator[validator].commission.toBigInt()/BigInt("100000"))/100,
                isBlocksNominations: validatorsInfoByValidator[validator].blocked.isTrue,
                isSlash: slashesByValidator[validator] != undefined,
                isOverSubscribed: amount.others.length > this.stakingInfo!.maxNominatorRewardedPerValidator,
                isIdentity: isIdentity,
            }
        }

        const candidateForTop: Record<string, ValidatorInfo> = {}
        for (const address of Object.keys(newValidatorCache)) {
            const v = newValidatorCache[address]
            if (
                v.commission > Const.NormalCommission ||
                v.isOverSubscribed ||
                v.isBlocksNominations ||
                v.isSlash ||
                !v.isIdentity
            ) {
                continue
            }

            candidateForTop[address] = v
        }

        const topValidators = Object.keys(candidateForTop)
            .sort((a, b) => new BN(newValidatorCache[b].totalStake).cmp(new BN(newValidatorCache[a].totalStake)))
            .slice(0, this.stakingInfo?.maxNominations)

        this.validators = newValidatorCache
        this.topValidators = topValidators
    }

    private async updateUsersStaking(): Promise<void> {
        const stakingInfo = await this.api.query.staking.ledger.entries()
        const targets = await this.api.query.staking.nominators.entries()

        const stakingByUser: Record<string, UserStakingInfo> = {}
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
            const userUnlocking: Array<Unlock> = []
            for (let unlocking of info.unlocking) {
                const era = unlocking.era.unwrap().toNumber()
                const duration = era - this.stakingInfo?.activeEra!

                if (duration < 0) {
                    hasWithdrawal = true
                }
                userUnlocking.push({
                    value: unlocking.value.unwrap().toBigInt(),
                    era: era
                })
            }

            stakingByUser[address] = {
                total: info.total.toBigInt(),
                active: info.active.toBigInt(),
                hasWithdrawal: hasWithdrawal,
                targets: [],
                unlocking: userUnlocking
            }
        }

        for (const target of targets) {
            const address = target[0].args[0].toHuman()
            const targetInfo = target[1].isNone ? null :  target[1].unwrap()
            if (targetInfo == null || targetInfo.targets.length == 0 || stakingByUser[address] == undefined) {
                continue
            }

            const stakingInfo = stakingByUser[address]

            const userTarget = []
            for (let validator of targetInfo.targets) {
                userTarget.push(validator.toHuman())
            }
            stakingInfo.targets = userTarget
        }

        this.usersStaking = stakingByUser
    }

    private async getAddressesForUpdateCache(blockHash: string): Promise<Map<string, boolean>> {
        const block = await this.api.rpc.chain.getBlock(blockHash)
        const records = await this.api.query.system.events.at(block.block.header.hash);

        const signers: Map<string, boolean> = new Map<string, boolean>()
        for (let index = 0; index < block.block.extrinsics.length; index++) {
            const extrinsic = block.block.extrinsics[index]

            const eventRecords = records
                .filter(({phase, event}) =>
                    phase.isApplyExtrinsic &&
                    phase.asApplyExtrinsic.eq(index) &&
                    !Cache._isExFailed(event)
                )

            if (eventRecords.length == 0) {
                continue
            }

            for (let eventIndex = 0; eventIndex < records.length; eventIndex++) {
                const record = records[eventIndex]

                if (
                    !record.phase.isApplyExtrinsic ||
                    !record.phase.asApplyExtrinsic.eq(index)
                ) {
                    continue
                }

                if (record.event.section != 'staking') {
                    continue
                }

                const signer = extrinsic.signer.toString()
                if (!signers.has(signer)) {
                    signers.set(signer, true)
                }
            }
        }

        return signers
    }

    public async init() {
        console.log("start updateStakingInfo")
        await this.updateStakingInfo()
        console.log("start updateValidators")
        await this.updateValidators()
        console.log("start updateUsersStaking")
        await this.updateUsersStaking()
    }
    public async subscriber() {
        await this.api.query.staking.activeEra((activeEra) => {
            const era =  activeEra.unwrap().index.toBn().toNumber()
            console.log("start updateStakingInfo...")
            console.log("active era: " + era)
            this.updateStakingInfo(era)
            console.log("end of updateStakingInfo")
        })

        await this.api.query.staking.currentEra((currentEra) => {
            const era = Number(currentEra)
            console.log("start updateValidators...")
            console.log("current era: " + era)
            this.updateValidators(era)
            console.log("end of updateValidators")
        })

        await this.api.rpc.chain.subscribeFinalizedHeads(async (header) => { //Refactoring with updateUsersStaking
            const addresses = await this.getAddressesForUpdateCache(header.hash.toHex())

            for (const address of addresses.keys()) {
                console.log("update address: " + address)
                const userStakingPromise = this.api.query.staking.ledger(address)
                const targetPromise = this.api.query.staking.nominators(address)

                const stakingInfo = await userStakingPromise
                const target = await targetPromise

                const info = stakingInfo.isNone ? null : stakingInfo.unwrap()
                if (info == null) {
                    if (this.usersStaking[address] != undefined) {
                        this.usersStaking[address] = undefined
                    }
                    continue
                }

                const userUnlocking: Array<Unlock> = []
                let hasWithdrawal = false
                for (let unlocking of info.unlocking) {
                    const era = unlocking.era.unwrap().toNumber()
                    const duration = era - this.stakingInfo?.activeEra!

                    if (duration < 0) {
                        hasWithdrawal = true
                    }
                    userUnlocking.push({
                        value: unlocking.value.unwrap().toBigInt(),
                        era: era
                    })
                }

                const targetInfo = target.isNone ? null :  target.unwrap()

                const userTarget = []
                if (targetInfo != null) {
                    for (let validator of targetInfo.targets) {
                        userTarget.push(validator.toHuman())
                    }
                }

                const userStaking: UserStakingInfo = {
                    total: info.total.toBigInt(),
                    active: info.active.toBigInt(),
                    hasWithdrawal: hasWithdrawal,
                    targets: userTarget,
                    unlocking: userUnlocking
                }
                this.usersStaking[address] = userStaking

                console.log("user staking info: " + JSON.stringify(userStaking, (key, value) =>
                    typeof value === "bigint" ? value.toString() + "n" : value
                ))
            }
        })
    }

    public getStakingInfo(): StakingInfo {
        return this.stakingInfo!
    }
    public getValidators(): Record<string, ValidatorInfo> {
        return this.validators
    }
    public getTopValidators(): Array<string> {
        return this.topValidators
    }
    public getUsersStaking(): Record<string, UserStakingInfo | undefined> {
        return this.usersStaking
    }
}
