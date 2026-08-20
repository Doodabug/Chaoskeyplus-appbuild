// Unit tests for humanToBaseHex (validator fix) in starknetWalletUtils.js
import { humanToBaseHex, baseToHuman } from "/app/frontend/src/lib/starknetWalletUtils.js";

let pass = 0;
let fail = 0;

function ok(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`PASS: ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL: ${name} ${extra}`);
  }
}

const validCases = [
  ["0.5", "500000000000000000"],
  [" 0.5 ", "500000000000000000"],
  ["0,5", "500000000000000000"],
  ["0.5 STRK", "500000000000000000"],
  ["0.5 strk", "500000000000000000"],
  ["1", "1000000000000000000"],
  ["1.234567890123456789", "1234567890123456789"],
  ["0. 5", "500000000000000000"],
  ["000.5", "500000000000000000"],
  ["1.5 ETH", "1500000000000000000"],
  ["12,25 USDC", "12250000000000000000"],
];

for (const [input, expected] of validCases) {
  let got;
  try {
    got = humanToBaseHex(input);
  } catch (e) {
    got = `THREW: ${e.message}`;
  }
  ok(`valid ${JSON.stringify(input)} -> ${expected}`, got === expected, `got ${got}`);
}

const invalidCases = [
  ["", "Enter an amount."],
  ["   ", "Enter an amount."],
  [null, "Enter an amount."],
  ["-1", "Amount cannot be negative."],
  ["-0.5", "Amount cannot be negative."],
  ["1e18", "Scientific notation not supported"],
  ["0.5.5", "too many decimal points"],
  ["abc", "not a valid amount"],
  ["0", "positive amount"],
  ["0.0", "positive amount"],
  ["1.2345678901234567891", "At most 18 decimal places"],
  ["0x10", "not a valid amount"],
];

for (const [input, expectedFragment] of invalidCases) {
  let msg = null;
  try {
    const r = humanToBaseHex(input);
    msg = `NO THROW (returned ${r})`;
  } catch (e) {
    msg = e.message;
  }
  ok(
    `invalid ${JSON.stringify(input)} -> "${expectedFragment}"`,
    typeof msg === "string" && msg.includes(expectedFragment),
    `got "${msg}"`
  );
}

// round-trip sanity with baseToHuman
ok("roundtrip 0.5", baseToHuman(humanToBaseHex("0,5 STRK")) === "0.5");
ok("roundtrip 1", baseToHuman(humanToBaseHex("1 STRK")) === "1");

console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
