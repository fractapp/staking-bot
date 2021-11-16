const {MathUtil} = require("../../src/utils/math");

it('test convertFromPlanckToString',() => {
    expect(MathUtil.convertFromPlanckToString(1000001n, 5)).toEqual("10.00001")
    expect(MathUtil.convertFromPlanckToString(1000000n, 5)).toEqual("10")
    expect(MathUtil.convertFromPlanckToString(100n, 5)).toEqual("0.001")
    expect(MathUtil.convertFromPlanckToString(2000040n, 5)).toEqual("20.0004")
});
