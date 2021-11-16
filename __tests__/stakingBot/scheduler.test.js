import {Scheduler} from "../../src/stakingBot/scheduler";
import {Message, Profile} from "../../src/types/api";
import {Action, Currency, fromCurrency} from "../../src/types/enums";

jest.mock('../../src/db/db', () => ({}))

const cache = {
    getStakingInfo: jest.fn(),
    getUsersStaking: jest.fn(),
    getTopValidators: jest.fn()
}
const db = {
    hasUser: jest.fn(),
    setUser: jest.fn(),
    getUsers: jest.fn()
}
const actionHandler = {
    withdrawRequests: jest.fn(),
    confirm: jest.fn()
}

const scheduler = new Scheduler(cache, cache, db, actionHandler)
it('test call', async () => {
    const target = [
        "1",
        "2",
        "3",
        "4",
        "5"
    ]
    const newTarget = [
        "1",
        "2",
        "6",
        "7",
        "8"
    ]
    let staking = {}
    const users = []
    for (let i = 0; i < 10; i++) {
        const address = "polkadotAddress" + i
        if (i !== 0) {
            staking[address] = ({
                total: 100n,
                active: i !== 1 ? 90n : 0n,
                hasWithdrawal: true,
                targets: target
            })
        }
        users.push({
            userId: "userId" + i,
            lastNotification: 0,
            addresses: {
                0: address,
                1: "kusamaAddress" + i,
            }
        })
    }

    cache.getUsersStaking.mockReturnValueOnce(staking)
    cache.getUsersStaking.mockReturnValueOnce({})
    actionHandler.withdrawRequests.mockReturnValue()
    actionHandler.confirm.mockReturnValue()

    cache.getTopValidators.mockReturnValue(newTarget)
    db.getUsers.mockReturnValueOnce(users)

    await scheduler.call()

    expect(actionHandler.withdrawRequests).toBeCalledTimes(9)
    for (let i = 1; i < 10; i++) {
        expect(actionHandler.withdrawRequests).toBeCalledWith({
            sender: "userId" + i,
        }, {
            addresses: {
                0: "polkadotAddress" + i,
                1: "kusamaAddress" + i,
            }
        })
    }

    expect(actionHandler.confirm).toBeCalledTimes(8)
    for (let i = 2; i < 10; i++) {
        expect(actionHandler.confirm).toBeCalledWith({
            sender: "userId" + i,
            args: {
                arguments: JSON.stringify({
                    action: String(Action.UpdateNominations),
                    currency: fromCurrency(Currency.DOT)
                })
            }
        }, {
            addresses: {
                0: "polkadotAddress" + i,
                1: "kusamaAddress" + i,
            }
        })
    }
});
