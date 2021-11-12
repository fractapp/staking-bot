import {Network} from "../types/enums";
import {ApiPromise} from "@polkadot/api";
import {TypeRegistry, construct, getRegistry, methods, UnsignedTransaction, createMetadata} from "@substrate/txwrapper-polkadot";
import { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import {BaseTxInfo, OptionsWithMeta} from "@substrate/txwrapper-core";
import {Keyring} from "@polkadot/keyring";
import BN from "bn.js";
import {CacheClient} from "./cacheClient";

type TxBase = {
    txVersion: number;
    genesisHash: string;
    specVersion: number;
    opt: OptionsWithMeta;
    registry: TypeRegistry;
}

export class TxBuilder {
    private readonly api: ApiPromise
    private readonly cache: CacheClient
    private readonly network: Network
    private txBase: TxBase | null = null

    constructor(api: ApiPromise, cache: CacheClient, network: Network) {
        this.api = api
        this.cache = cache
        this.network = network
    }

    public async init(): Promise<void> {
        const specVersion = this.api.runtimeVersion.specVersion.toNumber()
        const metadata = this.api.runtimeMetadata.toHex()

        const registry = getRegistry({
            chainName: this.network === Network.Polkadot ? 'Polkadot' : 'Kusama',
            specName: this.network === Network.Polkadot ? 'polkadot' : 'kusama',
            specVersion: specVersion,
            metadataRpc: metadata,
        });

        const opt: OptionsWithMeta = {
            metadataRpc: metadata,
            registry: registry,
        };

        const genesisHash = await this.api.rpc.chain.getBlockHash(0)
        const txVersion = await this.api.runtimeVersion.transactionVersion.toNumber()

        this.txBase = {
            txVersion: txVersion,
            specVersion: specVersion,
            genesisHash: genesisHash.toHex(),
            opt: opt,
            registry: registry
        }
    }

    private async getBase(sender: string): Promise<{
        opt: OptionsWithMeta,
        txInfo: BaseTxInfo,
        registry: TypeRegistry
    }> {
        const txBase = this.txBase!
        const noncePromise = this.api.rpc.system.accountNextIndex(sender)
        const blockHeaderPromise = await this.api.rpc.chain.getHeader()
        const nonce = await noncePromise
        const blockHeader = await blockHeaderPromise

        return {
            opt: txBase.opt,
            txInfo: {
                address: sender,
                blockHash: blockHeader.hash.toHex(),
                blockNumber: blockHeader.number.toNumber(),
                eraPeriod: 128,
                genesisHash: txBase.genesisHash,
                metadataRpc: txBase.opt.metadataRpc,
                nonce: nonce.toNumber(),
                specVersion: txBase.specVersion,
                tip: 0,
                transactionVersion: txBase.txVersion,
            },
            registry: txBase.registry
        };
    }

    public async bound(sender: string, amount: string): Promise<UnsignedTransaction> {
        const validators = await this.cache.getTopValidators()
        const stakingPromise = this.api.query.staking.ledger(sender)
        const basePrimise = this.getBase(sender)

        const staking = await stakingPromise
        const base = await basePrimise

        const stakingInfo = staking.isNone ? null : staking.unwrap()

        const nominate = methods.staking.nominate({
            targets: validators
        }, base.txInfo, base.opt);

        if (stakingInfo == null || stakingInfo.active.toBn().cmp(new BN(0)) == 0) {
            const bond = methods.staking.bond({
                controller: sender,
                value: amount,
                payee: "Staked"
            }, base.txInfo, base.opt);

            return methods.utility.batchAll({
                calls: [
                    bond.method,
                    nominate.method
                ],
            }, base.txInfo, base.opt);
        } else {
            const bondExtra = methods.staking.bondExtra({
                maxAdditional: amount
            }, base.txInfo, base.opt)
                /*    if (!targets.isNone) {
                const oldTargets = targets.unwrap().targets
                let count = 0

                const topValidatorsMap = new Map<string, boolean>()
                for (const validator of validators) {
                    topValidatorsMap.set(validator, true)
                }

                for (let nomination of oldTargets) {
                    if (topValidatorsMap.has(nomination.toHuman())) {
                        count++
                    }
                }

                if (count / validators.length <= Const.ThresholdUserNominations) {
                    return methods.utility.batchAll({
                        calls: [
                            bondExtra.method,
                            nominate.method
                        ],
                    }, base.txInfo, base.opt);
                } else {
                    return bondExtra
                }
            } */

            return bondExtra
        }
    }

    public async updateNominations(sender: string): Promise<UnsignedTransaction> {
        const validators = await this.cache.getTopValidators()

        const base = await this.getBase(sender)
        return methods.staking.nominate({
            targets: validators
        }, base.txInfo, base.opt);
    }

    public async withdraw(sender: string, amount: string, isFull: boolean = false): Promise<UnsignedTransaction> {
        const base = await this.getBase(sender)

        const unbound = methods.staking.unbond({
            value: amount
        }, base.txInfo, base.opt);

        if (isFull) {
            const chill = methods.staking.chill({}, base.txInfo, base.opt);

            return methods.utility.batchAll({
                calls: [
                    chill.method,
                    unbound.method
                ],
            }, base.txInfo, base.opt);
        }

        return unbound
    }

    public async confirmWithdraw(sender: string, numSlashingSpans: number): Promise<UnsignedTransaction> {
        const base = await this.getBase(sender)

        return  methods.staking.withdrawUnbonded({
            numSlashingSpans: numSlashingSpans
        }, base.txInfo, base.opt);
    }

    public async fakeSign(unsignedTx: UnsignedTransaction): Promise<string> {
        const account = new Keyring().addFromUri('fake')

        const base = await this.getBase(account.address)
        const signingPayload = construct.signingPayload(unsignedTx, {registry: base.registry})
        const {registry, metadataRpc} = base.opt;
        registry.setMetadata(createMetadata(registry, metadataRpc));

        const {signature} = registry
            .createType('ExtrinsicPayload', signingPayload, {
                version: EXTRINSIC_VERSION,
            })
            .sign(account);


        return construct.signedTx(unsignedTx, signature, base.opt);
    }
}
