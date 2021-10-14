import {ConstantsInfo, StakingInfo, ValidatorInfo} from "./types/staking";
import {ApiPromise} from "@polkadot/api";
import BN from "bn.js";
import {Const} from "./const";

export class Cache {
    private api: ApiPromise
    private validators: Record<string, ValidatorInfo> = <Record<string, ValidatorInfo>>{}
    private topValidators: Array<string> = []
    private stakingInfo: StakingInfo | null = null
    private constants: ConstantsInfo | null = null

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

    public async updateStakingInfo() {
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
        const decimals = (new BN(10)).pow(new BN(decimalsCount))

        const totalsByEra: Record<number, number> = {}
        for (const total of totals) {
            try {
                totalsByEra[Number(total[0].toHuman())] = total[1].toBn().div(decimals).toNumber()
            } catch (e) {
                console.log("e: " + e)
            }
        }

        const apys: Record<number, number> = {}
        for (const reward of rewards) {
            const era = Number(reward[0].toHuman())
            apys[era] = (reward[1].unwrap().toBn().div(decimals).toNumber())/totalsByEra[era]
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
            minStakingAmountPlanks: (await minStakingAmountPromise).toBn(),
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

    public async updateValidators() {
        const currentEraPromise = this.api.query.staking.currentEra()
        const validatorsInfoPromise = this.api.query.staking.validators.entries();

        const currentEra = Number(await currentEraPromise)
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

    public getStakingInfo(): StakingInfo {
        return this.stakingInfo!
    }

    public getValidators(): Record<string, ValidatorInfo> {
        return this.validators
    }
    public getTopValidators(): Array<string> {
        return this.topValidators
    }
}
