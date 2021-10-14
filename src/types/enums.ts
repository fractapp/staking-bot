export enum Network {
    Polkadot = 0,
    Kusama,
}

export enum Action {
    Open,
    AddAmount,
    CreateWithdrawRq,
    ConfirmWithdraw,
    UpdateNominations
}


export enum Currency {
    DOT = 0,
    KSM,
}


export function getNativeCurrency(network: Network): Currency {
    switch (network) {
        case Network.Polkadot:
            return Currency.DOT
        case Network.Kusama:
            return Currency.KSM
    }
}

export function getNetwork(currency: Currency): Network {
    switch (currency) {
        case Currency.DOT:
            return Network.Polkadot
        case Currency.KSM:
            return Network.Kusama
    }
}

export function getSymbol(currency: Currency) {
    let symbol = '';
    switch (currency) {
        case Currency.DOT:
            symbol = 'DOT';
            break;
        case Currency.KSM:
            symbol = 'KSM';
            break;
        default:
            throw new Error('invalid currency');
    }
    return symbol;
}

export function toCurrency(currency: string): Currency {
    switch (currency) {
        case 'DOT':
            return Currency.DOT;
        case 'KSM':
            return Currency.KSM;
        default:
            throw new Error('invalid currency');
    }
}

export function fromCurrency(currency: Currency): string {
    switch (currency) {
        case Currency.DOT:
            return 'DOT';
        case Currency.KSM:
            return 'KSM';
        default:
            throw new Error('invalid currency');
    }
}
