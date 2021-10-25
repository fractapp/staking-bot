import BN from "bn.js";

export namespace Const {
    export const Accuracy = new BN(1000)
    export const Sec = 1000
    export const Min = 60 * Sec
    export const Hour = 60 * Min
    export const NormalCommission = 20
    export const ThresholdUserNominations = 0.25
}
