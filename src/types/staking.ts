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
    activeEra: number,
    minStakingAmountPlanks: bigint,
    maxNominations: number,
    maxNominatorRewardedPerValidator: number,
    isAvailable: boolean,
    averageAPY: number,
    decimalsCount: number,
    eraDuration: number,
    decimals: bigint,
    unbondingPeriod: number
}

export type ConstantsInfo = {
    MaxNominations: number,
    MaxNominatorRewardedPerValidator: number,
    ExpectedBlockTime: number,
    EpochDuration: number,
    BondingDuration: number,
}
