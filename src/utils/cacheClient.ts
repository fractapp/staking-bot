import {StakingInfo, ValidatorInfo} from "../types/staking";
import {UserStakingInfo} from "../cache/cache";
import axios from "axios";
import {Const} from "./const";
import {Network} from "../types/enums";

const timeout = 3 * Const.Sec
const cacheLifetime = 3 * Const.Sec

export class CacheClient {
    private readonly host: string = ""
    private readonly network: Network
    private lastCacheTime: number = 0

    private validators: Record<string, ValidatorInfo> = <Record<string, ValidatorInfo>>{}
    private topValidators: Array<string> = []
    private stakingInfo: StakingInfo | null = null
    private usersStaking: Record<string, UserStakingInfo | undefined> = {}

    constructor(port: string, network: Network) {
        this.host = "http://localhost:" + port
        this.network = network
    }

    public async updateCache() {
        const response = await axios.get(`${this.host}/staking?network=${this.network}`, {
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
            },
            transformResponse: (res) => {
                return JSON.parse(res, (key, value) => {
                    if (typeof value === "string" && /^\d+n$/.test(value)) {
                        return BigInt(value.substr(0, value.length - 1));
                    }
                    return value;
                });
            },
        })

        if (response.status !== 200) {
            throw new Error("invalid update cache")
        }

        this.validators = response.data.validators
        this.topValidators = response.data.topValidators
        this.stakingInfo = response.data.stakingInfo
        this.usersStaking = response.data.usersStaking

        this.lastCacheTime = Date.now()
    }

    public async getUsersStaking(): Promise<Record<string, UserStakingInfo | undefined>> {
        const now = Date.now()
        if (now > this.lastCacheTime + cacheLifetime) {
            await this.updateCache()
        }

        return this.usersStaking
    }

    public async getStakingInfo(): Promise<StakingInfo> {
        const now = Date.now()
        if (now > this.lastCacheTime + cacheLifetime) {
            await this.updateCache()
        }

        return this.stakingInfo!
    }

    /* public async getValidators(): Promise<Record<string, ValidatorInfo>> {
         const now = Date.now()
         if (now > this.lastCacheTime + cacheLifetime) {
             await this.updateCache()
         }
         return this.validators
     }*/
    public async getTopValidators(): Promise<Array<string>> {
        const now = Date.now()
        if (now > this.lastCacheTime + cacheLifetime) {
            await this.updateCache()
        }
        return this.topValidators
    }
}
