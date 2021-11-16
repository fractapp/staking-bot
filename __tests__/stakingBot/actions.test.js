import {ActionHandler} from "../../src/stakingBot/actions";
import {TxBuilder} from "../../src/utils/txBuilder";
import {MessageCreator} from "../../src/stakingBot/messageCreator";
import {Action, Currency, fromCurrency} from "../../src/types/enums";
import {Profile} from "../../src/types/api";

jest.mock('@polkadot/api', () => ({}))
jest.mock('../../src/fractapp/client', () => ({}))
jest.mock('../../src/db/db', () => ({}))
jest.mock('../../src/utils/txBuilder', () => ({
    TxBuilder: jest.fn()
}))
jest.mock('../../src/stakingBot/messageCreator', () => ({
    MessageCreator: jest.fn()
}))

const api = {
    rpc: {
        payment: {
            queryInfo: jest.fn()
        }
    }
};
const cache = {
    getStakingInfo: jest.fn(),
    getUsersStaking: jest.fn()
}
const txBuilder = {
    bound: jest.fn(),
    fakeSign: jest.fn(),
    updateNominations: jest.fn()
}
const messageCreator = {
    getDeposit: jest.fn(),
    getNewDeposit: jest.fn(),
    getWithdrawRequests: jest.fn()
}
const client = {
    sendMsg: jest.fn()
}
const db = {
    hasUser: jest.fn(),
    setUser: jest.fn()
}
const sender = "sender"
const user = {
    id: "id",
    addresses: ["1", "2"]
}

MessageCreator.mockReturnValue(messageCreator)

it('test init', async () => {
    const initMock = jest.fn()
    TxBuilder.mockReturnValue({
        init: initMock
    })

    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.init()

    expect(initMock).toBeCalledTimes(2)
});

it('test initMsg', async () => {
    cache.getStakingInfo.mockReturnValueOnce({
        averageAPY: 13
    })
    cache.getStakingInfo.mockReturnValueOnce({
        averageAPY: 6
    })

    messageCreator.getDeposit.mockReturnValueOnce({
        value: "Polkadot deposit",
        hasWithdrawRequest: true,
        hasActiveAmount: false,
        isWarnExist: true
    })
    messageCreator.getDeposit.mockReturnValueOnce({
        value: "Kusama deposit",
        hasWithdrawRequest: false,
        hasActiveAmount: true,
        isWarnExist: true
    })

    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.initMsg({
        sender: sender
    },  user)

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
});

it('test chooseNewDeposit', async () => {
    messageCreator.getNewDeposit.mockReturnValueOnce({
        value: "Polkadot deposit",
        hasOpenedDeposit: true
    })
    messageCreator.getNewDeposit.mockReturnValueOnce({
        value: "Kusama deposit",
        hasOpenedDeposit: false
    })

    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.chooseNewDeposit({
        sender: sender
    },  user)

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test myDeposits', async () => {
    messageCreator.getDeposit.mockReturnValueOnce({
        value: "Polkadot deposit",
        hasWithdrawRequest: true,
        hasActiveAmount: false,
        isWarnExist: true
    })
    messageCreator.getDeposit.mockReturnValueOnce({
        value: "Kusama deposit",
        hasWithdrawRequest: false,
        hasActiveAmount: true,
        isWarnExist: true
    })

    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.myDeposits({
        sender: sender
    },  user)

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test withdrawRequests', async () => {
    messageCreator.getWithdrawRequests.mockReturnValueOnce({
        value: "Polkadot",
        totalWithdrawPlanks: 1000n,
        buttons: [
            {
                value: "v1",
                action: "action",
                arguments: {},
                imageUrl: null
            }
        ]
    })
    messageCreator.getWithdrawRequests.mockReturnValueOnce({
        value: "Kusama",
        totalWithdrawPlanks: 3000n,
        buttons: [
            {
                value: "v2",
                action: "action",
                arguments: {},
                imageUrl: null
            }
        ]
    })

    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.withdrawRequests({
        sender: sender
    },  user)

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test chooseWithdraw', async () => {
    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.chooseWithdraw({
        sender: sender
    })

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test successTx', async () => {
    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.successTx({
        sender: sender
    })

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test errorTx', async () => {
    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.errorTx({
        sender: sender
    })

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})

it('test enter', async () => {
    TxBuilder.mockReturnValue(txBuilder)

    cache.getUsersStaking.mockReturnValueOnce({})

    cache.getStakingInfo.mockReturnValueOnce({
        minStakingAmountPlanks: BigInt(150)
    })

    const unsignedTx = "unsignedTx"
    txBuilder.bound.mockReturnValueOnce(unsignedTx)
    api.rpc.payment.queryInfo.mockReturnValueOnce({
        partialFee: {
            toBn: () => 10n
        }
    })
    const action = new ActionHandler(client, api, api, cache, cache, db)
    await action.enter(Currency.DOT, Action.Open, sender, user, "error")

    expect(client.sendMsg.mock.calls[0]).toMatchSnapshot()
})
