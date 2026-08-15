import {
  baseToHuman,
  classifyPoolError,
  classifyShieldError,
  compareApiVersion,
  explorerTxUrl,
  humanToBaseHex,
  isFeltAddress,
  isStrk20Capable,
  maturityRemaining,
  maxSpendHuman,
  parseApiVersion,
  sameAddress,
} from "./starknetWalletUtils";

describe("parseApiVersion / isStrk20Capable", () => {
  test("parses dotted versions without treating 0.10 as 0.1", () => {
    expect(parseApiVersion("0.10.3")).toEqual({ major: 0, minor: 10, patch: 3 });
    expect(compareApiVersion(parseApiVersion("0.10.3"), parseApiVersion("0.9.0"))).toBeGreaterThan(
      0
    );
  });

  test("treats Wallet API >= 0.10 as STRK20-capable", () => {
    expect(isStrk20Capable(["0.10.3"])).toBe(true);
    expect(isStrk20Capable(["0.10"])).toBe(true);
    expect(isStrk20Capable(["0.9.5", "0.10.0"])).toBe(true);
    expect(isStrk20Capable(["0.9.0"])).toBe(false);
    expect(isStrk20Capable([])).toBe(false);
    expect(isStrk20Capable(null)).toBe(false);
  });

  test("does not use a balance read to feature-detect", () => {
    const source = isStrk20Capable.toString();
    expect(source).not.toMatch(/strk20Balances/);
  });
});

describe("sameAddress", () => {
  test("compares felts regardless of padding", () => {
    expect(
      sameAddress(
        "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
      )
    ).toBe(true);
    expect(sameAddress("0x1", "0x2")).toBe(false);
  });
});

describe("humanToBaseHex / baseToHuman", () => {
  test("converts 1 STRK to 1e18 hex", () => {
    expect(humanToBaseHex("1")).toBe(`0x${(10n ** 18n).toString(16)}`);
    expect(baseToHuman(10n ** 18n)).toBe("1");
  });

  test("handles fractional amounts", () => {
    expect(humanToBaseHex("0.5")).toBe(`0x${(5n * 10n ** 17n).toString(16)}`);
    expect(baseToHuman(5n * 10n ** 17n)).toBe("0.5");
  });

  test("rejects empty or non-positive input", () => {
    expect(() => humanToBaseHex("")).toThrow(/positive/);
    expect(() => humanToBaseHex("0")).toThrow(/positive/);
    expect(() => humanToBaseHex("-1")).toThrow(/positive/);
  });
});

describe("classifyPoolError", () => {
  test("maps screening decline distinctly", () => {
    expect(classifyPoolError({ message: "address_blocked" }).kind).toBe("screening");
    expect(classifyShieldError({ message: "screening unavailable" }).kind).toBe("screening");
    expect(classifyPoolError({ message: "screening unavailable" }).message).toMatch(
      /pool outcome/i
    );
  });

  test("maps wallet refusal, unregistered, and insufficient notes", () => {
    expect(classifyPoolError({ code: 113 }).kind).toBe("refused");
    expect(classifyPoolError({ message: "NOT_REGISTERED" }).kind).toBe("not_registered");
    expect(classifyPoolError({ code: 119 }).kind).toBe("insufficient");
  });
});

describe("isFeltAddress / maturityRemaining / maxSpendHuman", () => {
  test("accepts 0x felts only", () => {
    expect(isFeltAddress("0x123")).toBe(true);
    expect(isFeltAddress("123")).toBe(false);
    expect(isFeltAddress("")).toBe(false);
  });

  test("locks spend until 10 blocks after shield", () => {
    expect(maturityRemaining(100, 100)).toBe(10);
    expect(maturityRemaining(109, 100)).toBe(1);
    expect(maturityRemaining(110, 100)).toBe(0);
    expect(maturityRemaining(null, 100)).toBe(0);
  });

  test("MAX subtracts the pool fee", () => {
    expect(maxSpendHuman(10n ** 18n, 4n * 10n ** 18n)).toBe("0");
    expect(maxSpendHuman(10n * 10n ** 18n, 4n * 10n ** 18n)).toBe("6");
  });
});

describe("explorerTxUrl", () => {
  test("joins base and hash", () => {
    expect(explorerTxUrl("https://sepolia.voyager.online/tx", "0xabc")).toBe(
      "https://sepolia.voyager.online/tx/0xabc"
    );
  });
});
