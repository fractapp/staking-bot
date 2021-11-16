import {Currency, Network} from "../../src/types/enums";
import {MessageCreator} from "../../src/stakingBot/messageCreator";

const cache = ({
    getStakingInfo: jest.fn(),
    getUsersStaking: jest.fn()
})
const messageCreator = new MessageCreator(cache, Network.Polkadot, Currency.DOT)

it('test warning', async () => {
    cache.getStakingInfo.mockReturnValue({
        minStakingAmountPlanks: 123n,
        decimalsCount: 3
    })
    expect(await messageCreator.warning(1234n)).toEqual(null)
    expect(await messageCreator.warning(13n)).toMatchSnapshot()
});

it('test getNewDeposit', async () => {
    cache.getStakingInfo.mockReturnValueOnce({
        minStakingAmountPlanks: 1234n,
        decimals: 1000n
    })
    cache.getUsersStaking.mockReturnValueOnce({})

    const r = await messageCreator.getNewDeposit({
        addresses: {
            0: "addressDOT"
        }
    })
    expect(r.value).toMatchSnapshot()
    expect(r.hasOpenedDeposit).toEqual(false)
});

it('test getDeposit with non-empty deposit', async () => {
    cache.getStakingInfo.mockReturnValue({
        minStakingAmountPlanks: 123n,
        decimalsCount: 3,
        decimals: 1000n,
    })
    cache.getUsersStaking.mockReturnValueOnce({
        "addressDOT": {
            unlocking: [ "1", "2" ],
            active: 900n,
            total: 1000n,
        }
    })

    const r = await messageCreator.getDeposit({
        addresses: {
            0: "addressDOT"
        }
    })
    expect(r.value).toMatchSnapshot()
    expect(r.hasWithdrawRequest).toEqual(true)
    expect(r.hasActiveAmount).toEqual(true)
    expect(r.isWarnExist).toEqual(false)
});

it('test getDeposit with empty deposit', async () => {
    cache.getStakingInfo.mockReturnValue({
        minStakingAmountPlanks: 123n,
        decimalsCount: 3,
        decimals: 1000n,
    })
    cache.getUsersStaking.mockReturnValueOnce({
    })

    const r = await messageCreator.getDeposit({
        addresses: {
            0: "addressDOT"
        }
    })
    expect(r.value).toEqual(null)
    expect(r.hasWithdrawRequest).toEqual(false)
    expect(r.hasActiveAmount).toEqual(false)
    expect(r.isWarnExist).toEqual(false)
});

it('test getWithdrawRequests', async () => {
    cache.getStakingInfo.mockReturnValue({
        activeEra: 100,
        minStakingAmountPlanks: 123n,
        decimalsCount: 3,
        decimals: 1000n,
        eraDuration: 5
    })
    cache.getUsersStaking.mockReturnValueOnce({
        "addressDOT": {
            unlocking: [
                {
                    value: 1250n,
                    era: 101
                },
                {
                    value: 2250n,
                    era: 99
                },
                {
                    value: 3250n,
                    era: 99
                },
                {
                    value: 250n,
                    era: 101
                }
            ],
            active: 900n,
            total: 1000n,
        }
    })

    const r = await messageCreator.getWithdrawRequests({
        addresses: {
            0: "addressDOT"
        }
    })
    expect(r.value).toMatchSnapshot()
    expect(r.buttons).toEqual([
        {
            action: "confirm",
            arguments: {
                arguments: "{\"currency\":\"DOT\",\"action\":\"3\"}",
            },
            imageUrl: null,
            value: "Withdraw 5.5 DOT",
        },
        {
            action: "enter",
            arguments: {
                action: "2",
                currency: "DOT"
            },
            imageUrl: null,
            value:  "Create withdraw request for DOT",
        }
    ])
    expect(r.totalWithdrawPlanks).toEqual(5500n)
});
