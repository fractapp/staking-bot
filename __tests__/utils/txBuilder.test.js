import {Network} from "../../src/types/enums";
import {TxBuilder} from "../../src/utils/txBuilder";
import {getRegistry, methods} from "@substrate/txwrapper-polkadot";
import BN from "bn.js";

jest.mock('@polkadot/types/extrinsic/v4/Extrinsic', () => ({
    EXTRINSIC_VERSION: 4
}))
jest.mock('@polkadot/keyring', () => ({}))
jest.mock('@polkadot/api', () => ({}))
jest.mock("@substrate/txwrapper-polkadot", () => ({
    getRegistry: jest.fn(),
    methods: {
        staking: {
            nominate: jest.fn(),
            bond: jest.fn(),
            bondExtra: jest.fn(),
            unbond: jest.fn(),
            withdrawUnbonded: jest.fn(),
            chill: jest.fn()
        },
        utility: {
            batchAll: jest.fn()
        }
    }
}))
const api = {
    query: {
        staking: {
            ledger: jest.fn()
        }
    },
    runtimeVersion: {
        specVersion: {
            toNumber: () => 2
        },
        transactionVersion: {
            toNumber: () => 4
        }
    },
    runtimeMetadata: {
        toHex: () => "hex"
    },
    rpc: {
        chain: {
            getHeader: jest.fn(),
            getBlockHash: jest.fn(() => ({
                toHex: () => "block_hash"
            }))
        },
        system: {
            accountNextIndex: jest.fn()
        }
    }
};
const cache = ({
    getTopValidators: jest.fn()
})
const nonce = 101
function mockGetBase() {
    api.rpc.system.accountNextIndex.mockReturnValueOnce({
        toNumber: () => nonce
    })
    api.rpc.chain.getHeader.mockReturnValueOnce({
        hash: {
            toHex: () => "header_hex"
        },
        number: {
            toNumber: () => 542
        }
    })
}
function mockInit() {
    getRegistry.mockReturnValueOnce("registry")
}
it('test init',async () => {
    mockInit()
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)
    await txBuilder.init()

    expect(getRegistry).toBeCalledWith({
        chainName: 'Polkadot',
        specName: 'polkadot',
        specVersion: 2,
        metadataRpc: "hex",
    })

    expect(api.rpc.chain.getBlockHash).toBeCalledWith(0)
});

it('test bound',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"
    const amount = "10000"
    const validators = [
        "validators_1",
        "validators_2",
        "validators_3",
        "validators_4",
        "validators_5"
    ]

    mockInit()
    await txBuilder.init()
    mockGetBase()
    cache.getTopValidators.mockReturnValueOnce(validators)
    api.query.staking.ledger.mockReturnValueOnce({
        isNone: true
    })

    methods.utility.batchAll.mockReturnValueOnce("batchAll")
    methods.staking.nominate.mockReturnValueOnce({
        method: "nominate"
    })
    methods.staking.bond.mockReturnValueOnce({
        method: "bound"
    })

    const tx = await txBuilder.bound(sender, amount)

    expect(methods.staking.nominate.mock.calls[0][0]).toStrictEqual({
        targets: validators
    })
    expect(methods.staking.bond.mock.calls[0][0]).toStrictEqual({
        controller: sender,
        value: amount,
        payee: "Staked"
    })
    expect(methods.utility.batchAll.mock.calls[0][0]).toStrictEqual({
        calls: [
            "bound",
            "nominate"
        ],
    });
    expect(tx).toEqual("batchAll")
});

it('test boundExtra',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"
    const amount = "10000"
    const validators = [
        "validators_1",
        "validators_2",
        "validators_3",
        "validators_4",
        "validators_5"
    ]

    mockInit()
    await txBuilder.init()
    mockGetBase()
    cache.getTopValidators.mockReturnValueOnce(validators)
    api.query.staking.ledger.mockReturnValueOnce({
        isNone: false,
        unwrap: () => ({
            active: {
                toBn: () => new BN("1234")
            }
        })
    })

    methods.staking.nominate.mockReturnValueOnce({
        method: "nominate"
    })
    methods.staking.bondExtra.mockReturnValueOnce("bondExtra")

    const tx = await txBuilder.bound(sender, amount)

    expect(methods.staking.bondExtra.mock.calls[0][0]).toStrictEqual({
        maxAdditional: amount
    })
    expect(tx).toEqual("bondExtra")
});

it('test updateNominations',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"
    const validators = [
        "validators_1",
        "validators_2",
        "validators_3",
        "validators_4",
        "validators_5"
    ]

    mockInit()
    await txBuilder.init()
    mockGetBase()
    cache.getTopValidators.mockReturnValueOnce(validators)

    methods.staking.nominate.mockReturnValueOnce("nominate")
    methods.staking.nominate.mockReturnValueOnce("nominate")

    const tx = await txBuilder.updateNominations(sender)

    expect(methods.staking.nominate.mock.calls[0][0]).toStrictEqual({
        targets: validators
    })
    expect(tx).toEqual("nominate")
});

it('test withdraw',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"
    const amount = "10000"

    mockInit()
    await txBuilder.init()
    mockGetBase()

    methods.staking.unbond.mockReturnValueOnce("unbond")

    const tx = await txBuilder.withdraw(sender, amount, false)

    expect(methods.staking.unbond.mock.calls[0][0]).toStrictEqual({
        value: amount
    })
    expect(tx).toEqual("unbond")
});

it('test withdraw (isFull=true)',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"
    const amount = "10000"

    mockInit()
    await txBuilder.init()
    mockGetBase()

    methods.staking.unbond.mockReturnValueOnce({
        method: "unbound"
    })
    methods.staking.chill.mockReturnValueOnce({
        method: "chill"
    })
    methods.utility.batchAll.mockReturnValueOnce("batchAll")
    const tx = await txBuilder.withdraw(sender, amount, true)

    expect(methods.staking.unbond.mock.calls[0][0]).toStrictEqual({
        value: amount
    })
    expect(methods.staking.chill.mock.calls[0][0]).toStrictEqual({})
    expect(methods.utility.batchAll.mock.calls[0][0]).toStrictEqual({
        calls: [
            "chill",
            "unbound"
        ],
    })
    expect(tx).toEqual("batchAll")
});

it('test confirmWithdraw',async () => {
    const txBuilder = new TxBuilder(api, cache, Network.Polkadot)

    const sender = "sender"

    mockInit()
    await txBuilder.init()
    mockGetBase()

    methods.staking.withdrawUnbonded.mockReturnValueOnce("withdrawUnbonded")
    const tx = await txBuilder.confirmWithdraw(sender, 0)

    expect(methods.staking.withdrawUnbonded.mock.calls[0][0]).toStrictEqual({
        numSlashingSpans: 0
    })
    expect(tx).toEqual("withdrawUnbonded")
});
