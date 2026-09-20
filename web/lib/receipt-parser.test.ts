import assert from "node:assert/strict";
import test from "node:test";

import { extractDate, parseReceipt } from "./receipt-parser.ts";

const sevenElevenOcr = `
AnH 7등 편으 으/짐 Fl
(9) 혀리아세컨 Ww 7 eleven co Kr
lie 2429 £2 문정수정점#18308
[만 매] 2020 06- 09 (Sh 20:50:47
상품명 수량 금 액
= 73 ~ 7 = 편으/정
세븐릴레른 문정수정점#18308
[만 때] 2020-06-0b (회) 20:59:47
라이스윗 바닐라파인트474 1 6,900
라이스윗 초코파인트474ml 1 6,900
비닐봉투 보증금 20원 20
과세물품가액 12,545
부가세 1,255
봉투보증금액 20
= a W113, 820
`;

test("rejects invalid OCR dates and accepts the valid alternate pass", () => {
  assert.equal(extractDate("2020-06-00\n2020 06- 09"), "2020-06-09");
});

test("parses the supplied Seven Eleven receipt OCR", () => {
  assert.deepEqual(parseReceipt(sevenElevenOcr), {
    merchant: "세븐일레븐 문정수정점",
    date: "2020-06-09",
    amount: "13820",
    category: "식비",
    description: "세븐일레븐 문정수정점 영수증",
  });
});

test("parses a clean total without receipt-specific assumptions", () => {
  assert.deepEqual(parseReceipt("스타벅스 강남점\n2026-09-21\n총 결제금액 ₩12,800"), {
    merchant: "스타벅스 강남점",
    date: "2026-09-21",
    amount: "12800",
    category: "식비",
    description: "스타벅스 강남점 영수증",
  });
});
