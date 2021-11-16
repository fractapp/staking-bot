import {Network} from "../../src/types/enums";
import {CacheClient} from "../../src/utils/cacheClient";
import {Const} from "../../src/utils/const";
import axios from "axios";

jest.mock("axios", () => ({
    get: jest.fn()
}));

const cacheClient = new CacheClient("4040", Network.Polkadot)
it('Cache test', async () => {
    const usersStaking = {
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
    }
    const stakingInfo = {
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
    }
    const topValidators = [
        'validator0',
        'validator1',
        'validator2',
        'validator3',
        'validator4'
    ]

    axios.get.mockReturnValue({
        status: 200,
        data: {
            validators: null,
            topValidators: topValidators,
            stakingInfo: stakingInfo,
            usersStaking: usersStaking
        }
    })
    let time = 1487076708000
    Date.now = jest.fn(() => time)
    expect(await cacheClient.getUsersStaking()).toStrictEqual(usersStaking)

    time += 4 * Const.Sec
    expect(await cacheClient.getStakingInfo()).toStrictEqual(stakingInfo)

    time += 4 * Const.Sec
    expect(await cacheClient.getTopValidators()).toStrictEqual(topValidators)

    expect(axios.get).toBeCalledTimes(3)
});
