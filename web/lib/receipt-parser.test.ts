import assert from "node:assert/strict";
import test from "node:test";

import { analyzeReceiptPasses, extractDate, parseReceipt } from "./receipt-parser.ts";

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
    currency: "KRW",
    category: "식비",
    description: "세븐일레븐 문정수정점 영수증",
  });
});

test("parses a clean total without receipt-specific assumptions", () => {
  assert.deepEqual(parseReceipt("스타벅스 강남점\n2026-09-21\n총 결제금액 ₩12,800"), {
    merchant: "스타벅스 강남점",
    date: "2026-09-21",
    amount: "12800",
    currency: "KRW",
    category: "식비",
    description: "스타벅스 강남점 영수증",
  });
});

test("repairs a malformed Korean grouping and recognizes Seven Eleven by its support number", () => {
  const ocr = `
  4,18 we
  [1 04] 2019-09-10 (회) 14
  판결싸. 보액3입
  2,60
  세계 18 me EE
  부 가 서 736 6
  Egle 고객센터 1577-0711
  `;
  assert.deepEqual(parseReceipt(ocr), {
    merchant: "세븐일레븐",
    date: "2019-09-10",
    amount: "2600",
    currency: "KRW",
    category: "식비",
    description: "세븐일레븐 영수증",
  });
});

test("reconciles a noisy USD total from subtotal, tax, and tip", () => {
  const ocr = `
  EPIC STEAKHOUSE
  RECEIPT
  SUBTOTAL $185.00
  TAX 17.02
  TIP $715.00
  TOTAL $211.02
  `;
  assert.deepEqual(parseReceipt(ocr), {
    merchant: "EPIC STEAKHOUSE",
    date: "",
    amount: "277.02",
    currency: "USD",
    category: "식비",
    description: "EPIC STEAKHOUSE 영수증",
  });
});

test("leaves the merchant blank when a cropped receipt only contains policy text", () => {
  const ocr = `
  개
  기내(신선 7일)
  능(결제카드지참)
  P0S:1021-5338
  [구매]2017-06-02 21:13
  상품명 단가 수량 금액
  합      계 73,550
  `;
  assert.deepEqual(parseReceipt(ocr), {
    merchant: "",
    date: "2017-06-02",
    amount: "73550",
    currency: "KRW",
    category: "기타",
    description: "영수증 경비",
  });
});

test("parses compact and two-digit receipt dates", () => {
  assert.equal(extractDate("거래일시 25/11/25 14:17:55"), "2025-11-25");
  assert.equal(extractDate("판매일자 20241218"), "2024-12-18");
});

test("recognizes common merchants and ungrouped labeled totals", () => {
  assert.deepEqual(
    parseReceipt("CU 종암도점\n2025-10-14\n총구매액 3 6000원"),
    {
      merchant: "CU 종암도점",
      date: "2025-10-14",
      amount: "6000",
      currency: "KRW",
      category: "식비",
      description: "CU 종암도점 영수증",
    },
  );
});

test("detects Vietnamese dong receipts", () => {
  assert.deepEqual(
    parseReceipt("LOTTE Mart DA NANG\n2025-10-22\nTong cong 994,000"),
    {
      merchant: "롯데마트",
      date: "2025-10-22",
      amount: "994000",
      currency: "VND",
      category: "기타",
      description: "롯데마트 영수증",
    },
  );
});

test("uses field agreement instead of exposing raw OCR confidence", () => {
  const result = analyzeReceiptPasses([
    { text: "스타벅스\n2020-12-19\n총결제금액 18,300원", confidence: 43 },
    { text: "STARBUCKS\n2020/12/19\n합계 18,300", confidence: 51 },
  ]);
  assert.deepEqual(result.draft, {
    merchant: "스타벅스",
    date: "2020-12-19",
    amount: "18300",
    currency: "KRW",
    category: "식비",
    description: "스타벅스 영수증",
  });
  assert.ok(result.confidence >= 80);
});

test("prioritizes user-provided final-price labels", () => {
  for (const label of [
    "결재 금액",
    "결제 금액",
    "합계",
    "합계 금액",
    "TOTAL",
    "결재 대상 금액",
    "결제 대상 금액",
  ]) {
    const parsed = parseReceipt(`테스트 식당\n상품 금액 18,000원\n부가세 1,800원\n${label} 19,800원`);
    assert.equal(parsed.amount, "19800", label);
  }
});
