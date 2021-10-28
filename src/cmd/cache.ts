import {Network} from "../types/enums";
import {ApiPromise, WsProvider} from "@polkadot/api";
import dotenv from "dotenv";
import {Cache} from "../cache/cache";
import express from 'express';
import morgan from 'morgan'

dotenv.config()

export const app = express()
export let server: any = null
dotenv.config()
app.use(morgan('combined'))

let cacheByNetwork: Map<Network, Cache> = new Map<Network, Cache>()

async function start() {
    console.log("start cache server...")

    const cacheServerPort = process.env["CACHE_PORT"] as string
    const apiPolkadot = await getApiInstance(process.env["POLKADOT_RPC_URL"] as string)
    const apiKusama = await getApiInstance(process.env["KUSAMA_RPC_URL"] as string)

    cacheByNetwork.set(Network.Polkadot, new Cache(apiPolkadot))
    cacheByNetwork.set(Network.Kusama, new Cache(apiKusama))

    console.log("init blockchain info...")

    await cacheByNetwork.get(Network.Polkadot)!.init()
    await cacheByNetwork.get(Network.Kusama)!.init()

    console.log("end of init blockchain info")

    console.log("start subscribe...")
    await Promise.all([
        cacheByNetwork.get(Network.Polkadot)!.subscriber(),
        cacheByNetwork.get(Network.Kusama)!.subscriber()
    ])

    console.log("end of subscribe...")

    app.use(function (err: any, req: any, res: any, next: any) {
        console.error(err.stack);
        res.status(500).send();
    });
    server = app.listen(cacheServerPort, () => {
        console.log(`Example app listening at http://localhost:${cacheServerPort}`)
    })
}

async function getApiInstance(wssUrl: string): Promise<ApiPromise> {
    const wsProvider = new WsProvider(wssUrl);
    return await ApiPromise.create({provider: wsProvider})
}

app.get('/staking', (req, res) => {
    const network: Network = Number(req.query.network)
    const cache = cacheByNetwork.get(network)!

    return res.send(JSON.stringify({
            validators: cache.getValidators(),
            topValidators: cache.getTopValidators(),
            stakingInfo: cache.getStakingInfo(),
            usersStaking: cache.getUsersStaking(),
        }, (key, value) =>
            typeof value === "bigint" ? value.toString() + "n" : value
    ));
})

start()
