import {Currency, fromCurrency, getNativeCurrency, getNetwork, Network, toCurrency} from "../../src/types/enums";

it('getNativeCurrency', async () => {
    expect(getNativeCurrency(Network.Polkadot)).toEqual(Currency.DOT)
    expect(getNativeCurrency(Network.Kusama)).toEqual(Currency.KSM)
});

it('getNetwork', async () => {
    expect(getNetwork(Currency.DOT)).toEqual(Network.Polkadot)
    expect(getNetwork(Currency.KSM)).toEqual(Network.Kusama)
});

it('toCurrency', async () => {
    expect(toCurrency("DOT")).toEqual(Currency.DOT)
    expect(toCurrency("KSM")).toEqual(Currency.KSM)
});

it('fromCurrency', async () => {
    expect(fromCurrency(Currency.DOT)).toEqual("DOT")
    expect(fromCurrency(Currency.KSM)).toEqual("KSM")
});
