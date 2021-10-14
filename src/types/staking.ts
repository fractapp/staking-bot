import BN from "bn.js";

export type ValidatorInfo = {
    ownStake: string,
    totalStake: string,
    commission: number,
    isBlocksNominations: boolean,
    isSlash: boolean
    isOverSubscribed: boolean
    isIdentity: boolean,
}

export type StakingInfo = {
    minStakingAmountPlanks: BN,
    maxNominations: number,
    maxNominatorRewardedPerValidator: number,
    isAvailable: boolean,
    averageAPY: number,
    decimalsCount: number,
    eraDuration: number,
    decimals: BN,
    unbondingPeriod: number
}

export type ConstantsInfo = {
    MaxNominations: number,
    MaxNominatorRewardedPerValidator: number,
    ExpectedBlockTime: number,
    EpochDuration: number,
    BondingDuration: number,
}