import BN from "bn.js";

export namespace MathUtil {
    export function convertFromPlanckToString(
        planck: bigint,
        decimals: number,
    ): string {
        let value = planck.toString();

        const length = value.length;
        if (length < decimals) {
            for (let i = 0; i < decimals - length; i++) {
                value = '0' + value;
            }
        }

        let lastPart = value.substr(value.length - decimals);
        let newLastPart = lastPart;
        for (let i = lastPart.length - 1; i >= 0; i--) {
            if (lastPart[i] !== '0') {
                break;
            }
            newLastPart = newLastPart.slice(0, i);
        }

        value = value.substr(0, value.length - decimals) + '.' + newLastPart;

        if (value.startsWith('.')) {
            value = '0' + value;
        }
        if (value.endsWith('.')) {
            value = value.slice(0, value.length - 1);
        }

        return value;
    }
}
