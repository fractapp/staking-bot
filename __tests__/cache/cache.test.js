import {Cache} from "../../src/cache/cache";
import BN from "bn.js";

const api = {
    rpc: {
        chain: {
            subscribeFinalizedHeads: jest.fn()
        }
    },
    consts: {
        staking: {
            maxNominations: {
                toNumber: jest.fn()
            },
            maxNominatorRewardedPerValidator: {
                toNumber: jest.fn()
            },
            bondingDuration: {
                toNumber: jest.fn()
            },
        },
        babe: {
            expectedBlockTime: {
                toNumber: jest.fn()
            },
            epochDuration: {
                toNumber: jest.fn()
            },
        }
    },
    query: {
        staking: {
            activeEra: jest.fn(),
            maxNominatorsCount: jest.fn(),
            maxSystemNominatorsCount: jest.fn(),
            counterForNominators: jest.fn(),
            minNominatorBond: jest.fn(),
            erasTotalStake: {
                entries: jest.fn()
            },
            erasValidatorReward: {
                entries: jest.fn()
            },
            currentEra: jest.fn(),
            validators: {
                entries: jest.fn()
            },
            validatorSlashInEra: {
                entries: jest.fn()
            },
            erasStakers: {
                entries: jest.fn()
            },
            ledger: {
                entries: jest.fn()
            },
            nominators: {
                entries: jest.fn()
            },
        },
        identity: {
            superOf: {
                entries: jest.fn()
            },
            identityOf: {
                entries: jest.fn()
            }
        }
    },
    registry: {
        getChainProperties: jest.fn()
    }
};

function mockUpdateStakingInfo(activeEra) {
    const consts = {
        MaxNominations: 5,
        MaxNominatorRewardedPerValidator: 100,
        ExpectedBlockTime: 6,
        EpochDuration: 10,
        BondingDuration: 20
    }

    //getConstants
    api.consts.staking.maxNominations.toNumber.mockReturnValueOnce(consts.MaxNominations)
    api.consts.staking.maxNominatorRewardedPerValidator.toNumber.mockReturnValueOnce(consts.MaxNominatorRewardedPerValidator)

    api.consts.babe.expectedBlockTime.toNumber.mockReturnValueOnce(consts.ExpectedBlockTime)
    api.consts.babe.epochDuration.toNumber.mockReturnValueOnce(consts.EpochDuration)
    api.consts.staking.bondingDuration.toNumber.mockReturnValueOnce(consts.BondingDuration)

    //updateStakingInfo
    api.query.staking.maxNominatorsCount.mockReturnValueOnce(100)
    api.query.staking.counterForNominators.mockReturnValueOnce(10)
    api.registry.getChainProperties.mockReturnValueOnce({
        tokenDecimals: {
            toHuman: jest.fn(() => 5)
        }
    })
    api.query.staking.minNominatorBond.mockReturnValueOnce({
        toBigInt: jest.fn(() => BigInt("100000"))
    })
    api.query.staking.erasTotalStake.entries.mockReturnValueOnce([
        [
            {
                toHuman: () => "1"
            },
            {
                toBigInt: () => BigInt(10000000)
            }
        ]
    ])
    api.query.staking.erasValidatorReward.entries.mockReturnValueOnce([
        [
            {
                toHuman: () => "1"
            },
            {
                unwrap: () => ({
                    toBigInt: () => BigInt(1000)
                })
            }
        ]
    ])
}

function mockUpdateValidators(currentEra) {
    const validators = []
    const slashed = []
    const stakesAmount = []
    const superIdentities = []
    const identitiesByValidator = []

    for (let i = 0; i < 10; i++) {
        const address = "validator" + i

        validators.push([
            {
                args: [
                    {
                        toString: () => address
                    }
                ]
            },
            {
                commission: {
                    toBigInt: () => BigInt(1000000)
                },
                blocked: {
                    isTrue: i === 9
                }
            }
        ])
        slashed.push([
            {
                args: [
                    "",
                    {
                        toString: () => address
                    }
                ]
            },
            {
                isNone: i !== 8
            }
        ])
        stakesAmount.push([
            {
                args: [
                    "",
                    {
                        toString: () => address
                    }
                ]
            },
            {
                own: {
                    toBn: () => "10000000",
                },
                total: {
                    toBn: () => "100000000",
                },
                others: {
                    length: 1
                }
            }
        ])

        superIdentities.push([
            {
                args: [
                    {
                        toString: () => address
                    }
                ]
            },
            {
                unwrap: () => [
                    {
                        toString: () => (i % 2 === 0 ? "identitie" + i : address)
                    }
                ]
            }
        ])
        identitiesByValidator.push([
            {
                args: [
                    {
                        toString: () => i % 2 === 0 ? "identitie" + i : address
                    }
                ]
            },
            {
                unwrap: () => ({
                    size: 3
                })
            }
        ])
    }
    api.query.staking.validators.entries.mockReturnValueOnce(validators);
    api.query.staking.validatorSlashInEra.entries.mockReturnValueOnce(slashed)
    api.query.staking.erasStakers.entries.mockReturnValueOnce(stakesAmount)
    api.query.identity.superOf.entries.mockReturnValueOnce(superIdentities)
    api.query.identity.identityOf.entries.mockReturnValueOnce(identitiesByValidator)
}

function mockUpdateUsersStaking() {
    const ledgersEntries = []
    const targets = []

    for (let i = 0; i < 10; i++) {
        const address = "user" + i

        ledgersEntries.push([
            {
                args: [
                    {
                        toHuman: () => address
                    }
                ]
            },
            {
                isNone: i === 0,
                unwrap: () => ({
                    total: {
                        toBigInt: () => BigInt("1000000")
                    },
                    active: {
                        toBigInt: () => BigInt("100000")
                    },
                    unlocking: [
                        {
                            era: {
                                unwrap: () => ({
                                    toNumber: () => 1
                                })
                            },
                            value: {
                                unwrap: () => ({
                                    toBigInt: () => BigInt("100000")
                                })
                            },
                        }
                    ]
                })
            }
        ])
        targets.push([
            {
                args: [
                    {
                        toHuman: () => address
                    }
                ]
            },
            {
                isNone: i === 0,
                unwrap: () => ({
                    targets: [
                        {
                            toHuman: () => "validator" + i
                        }
                    ]
                })
            }
        ])
    }

    api.query.staking.ledger.entries.mockReturnValueOnce(ledgersEntries)
    api.query.staking.nominators.entries.mockReturnValueOnce(targets)
}

it('Cache test', async () => {
    const startEra = new BN("1230")
    api.query.staking.activeEra.mockReturnValueOnce({
        unwrap: jest.fn(() => ({
            index: {
                toBn: () => startEra
            }
        }))
    })
    mockUpdateStakingInfo(startEra)

    const currentEra = "1230"
    api.query.staking.currentEra.mockReturnValueOnce(currentEra)
    mockUpdateValidators(currentEra)
    mockUpdateUsersStaking()

    const cache = new Cache(api)
    await cache.init()

    expect(cache.getStakingInfo()).toStrictEqual({
        activeEra: 1230,
        minStakingAmountPlanks: 100000n,
        maxNominations: 5,
        maxNominatorRewardedPerValidator: 100,
        isAvailable: false,
        averageAPY: 0,
        decimalsCount: 5,
        decimals: 100000n,
        eraDuration: 0.0001,
        unbondingPeriod: 0.00008333333333333333
    })
    expect(cache.getTopValidators()).toStrictEqual([
        'validator0',
        'validator1',
        'validator2',
        'validator3',
        'validator4'
    ])
    expect(cache.getValidators()).toStrictEqual({
        validator0: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator1: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator2: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator3: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator4: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator5: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator6: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator7: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator8: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: false,
            isSlash: true,
            isOverSubscribed: false,
            isIdentity: true
        },
        validator9: {
            ownStake: '10000000',
            totalStake: '100000000',
            commission: 0.1,
            isBlocksNominations: true,
            isSlash: false,
            isOverSubscribed: false,
            isIdentity: true
        }
    })
    expect(cache.getUsersStaking()).toStrictEqual({
        user1: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator1'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user2: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator2'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user3: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator3'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user4: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator4'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user5: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator5'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user6: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator6'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user7: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator7'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user8: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator8'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        },
        user9: {
            total: 1000000n,
            active: 100000n,
            hasWithdrawal: true,
            targets: ['validator9'],
            unlocking: [
                {
                    value: BigInt("100000"),
                    era: 1,
                }
            ]
        }
    })

    await cache.subscriber()
    api.query.staking.activeEra.mockReturnValueOnce()
    api.query.staking.currentEra.mockReturnValueOnce()

    const nextEra = new BN("3000")
    mockUpdateStakingInfo(nextEra)
    await api.query.staking.activeEra.mock.calls[1][0]({
        unwrap: jest.fn(() => ({
            index: {
                toBn: () => nextEra
            }
        }))
    })

    const nextCurrentEra = "3245"
    mockUpdateValidators(nextCurrentEra)
    await api.query.staking.currentEra.mock.calls[1][0](nextCurrentEra)

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(cache.getStakingInfo()).toStrictEqual({
        activeEra: 3000,
        minStakingAmountPlanks: 100000n,
        maxNominations: 5,
        maxNominatorRewardedPerValidator: 100,
        isAvailable: false,
        averageAPY: 0,
        decimalsCount: 5,
        decimals: 100000n,
        eraDuration: 0.0001,
        unbondingPeriod: 0.00008333333333333333
    })
    expect(api.query.staking.validatorSlashInEra.entries).toBeCalledWith(Number(nextCurrentEra))
    expect(api.query.staking.erasStakers.entries).toBeCalledWith(Number(nextCurrentEra))
});
