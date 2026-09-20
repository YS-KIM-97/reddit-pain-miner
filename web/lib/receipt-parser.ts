export type ExpenseDraft = {
  merchant: string;
  date: string;
  amount: string;
  category: string;
  description: string;
};

const TOTAL_WORDS = /total|amount|grand|합계|총액|결제|받을금액|판매금액/i;
const TAX_WORDS = /과세|부가세|면세|공급가액/i;
const NON_MERCHANT_WORDS =
  /영수증|receipt|사업자|대표자|전화|tel|주소|date|일시|카드|판매|상품명|수량|금액/i;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeOcrDigits(value: string) {
  return value
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[bB]/g, "6")
    .replace(/[sS]/g, "5");
}

function validDate(year: number, month: number, day: number) {
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

export function extractDate(text: string) {
  const candidates = [
    ...text.matchAll(
      /\b(?:19|20)[0-9OIl]{2}\s*(?:[./-]\s*|\s+)[0-1OIl]?[0-9OIl]\s*[./-]\s*[0-3OIlbB][0-9OIlbB]\b/g,
    ),
    ...text.matchAll(
      /\b(?:19|20)[0-9OIl]{2}\s*년\s*[0-1OIl]?[0-9OIl]\s*월\s*[0-3OIlbB][0-9OIlbB]?\s*일/g,
    ),
  ];

  for (const candidate of candidates) {
    const parts = normalizeOcrDigits(candidate[0]).match(/\d+/g);
    if (!parts || parts.length < 3) continue;
    const [year, month, day] = parts.map(Number);
    if (!validDate(year, month, day)) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

export function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (
    /coffee|cafe|restaurant|food|starbucks|7\s*eleven|식당|카페|커피|스타벅스|김밥|치킨|식사|편의점|세븐일레븐|바닐라|초코/.test(
      lower,
    )
  ) {
    return "식비";
  }
  if (/taxi|bus|train|metro|parking|택시|버스|지하철|주차|철도/.test(lower)) {
    return "교통";
  }
  if (/hotel|stay|inn|호텔|숙박|리조트/.test(lower)) return "숙박";
  if (/book|course|class|도서|강의|교육/.test(lower)) return "교육";
  if (/office|paper|pen|문구|프린터|용지|사무/.test(lower)) return "사무용품";
  return "기타";
}

function extractBranch(lines: string[]) {
  for (const line of lines) {
    if (!line.includes("점")) continue;
    const matches = line.match(/[가-힣]{2,12}점/g) ?? [];
    const branch = matches.find((value) => !/편의점|할인점|판매점/.test(value));
    if (branch) return branch;
  }
  return "";
}

export function extractMerchant(lines: string[]) {
  const joined = lines.join(" ");
  const branch = extractBranch(lines);
  const knownBrands: Array<[RegExp, string]> = [
    [/7\s*[-.]?\s*eleven|세븐.{0,4}(?:일|릴)?레|일레븐/i, "세븐일레븐"],
    [/(?:^|\s)gs\s*25(?:\s|$)|지에스\s*25/i, "GS25"],
    [/(?:^|\s)cu(?:\s|$)|씨유/i, "CU"],
    [/emart\s*24|이마트\s*24/i, "이마트24"],
    [/starbucks|스타벅스/i, "스타벅스"],
  ];
  const known = knownBrands.find(([pattern]) => pattern.test(joined));
  if (known) return branch ? `${known[1]} ${branch}` : known[1];

  return (
    lines.find(
      (line) =>
        line.length >= 2 &&
        line.length <= 36 &&
        !NON_MERCHANT_WORDS.test(line) &&
        !/^\W?\d/.test(line) &&
        /[가-힣A-Za-z]/.test(line),
    ) ?? ""
  );
}

type AmountCandidate = {
  value: number;
  lineIndex: number;
  score: number;
  correctedCurrency: boolean;
};

function parsedNumber(value: string) {
  const digits = normalizeOcrDigits(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function hasSumSupport(target: number, candidates: AmountCandidate[]) {
  const values = candidates
    .map((candidate) => candidate.value)
    .filter((value) => value > 0 && value < target);
  for (let first = 0; first < values.length; first += 1) {
    for (let second = first + 1; second < values.length; second += 1) {
      if (values[first] + values[second] === target) return true;
      for (let third = second + 1; third < values.length; third += 1) {
        if (values[first] + values[second] + values[third] === target) return true;
      }
    }
  }
  return false;
}

export function extractAmount(lines: string[]) {
  const candidates: AmountCandidate[] = [];
  const amountPattern = /[₩￦Ww]?\s*[0-9OIl]{1,4}(?:\s*[,，.]\s*[0-9OIl]{3})+/g;

  lines.forEach((line, lineIndex) => {
    const matches = line.match(amountPattern) ?? [];
    for (const match of matches) {
      const value = parsedNumber(match);
      if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) continue;
      const hasCurrency = /^[₩￦Ww]/.test(match.trim());
      let score = (lineIndex / Math.max(lines.length - 1, 1)) * 6 + 2;
      if (TOTAL_WORDS.test(line)) score += 12;
      if (hasCurrency) score += 6;
      if (TAX_WORDS.test(line)) score -= 4;
      if (/사업자|전화|tel|승인|카드번호|품번/i.test(line)) score -= 12;
      if (/\d{2,4}[./-]\s*\d{1,2}/.test(line) || /\d{1,2}:\d{2}/.test(line)) score -= 10;
      candidates.push({ value, lineIndex, score, correctedCurrency: false });

      // The printed won sign is commonly read as "W1". Keep the raw value too,
      // then prefer the repaired value only when other receipt amounts support it.
      const compact = normalizeOcrDigits(match).replace(/\s/g, "");
      const malformedWon = compact.match(/^[Ww]1(\d{2,3}[,.]\d{3})$/);
      if (malformedWon) {
        candidates.push({
          value: parsedNumber(malformedWon[1]),
          lineIndex,
          score: score + 2,
          correctedCurrency: true,
        });
      }
    }
  });

  for (const candidate of candidates) {
    if (candidate.correctedCurrency && hasSumSupport(candidate.value, candidates)) {
      candidate.score += 10;
    }
  }

  candidates.sort((left, right) => right.score - left.score || right.lineIndex - left.lineIndex);
  return candidates[0]?.value ?? 0;
}

export function parseReceipt(text: string): ExpenseDraft {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const merchant = extractMerchant(lines);
  const amount = extractAmount(lines);

  return {
    merchant,
    date: extractDate(text),
    amount: amount ? String(Math.round(amount)) : "",
    category: inferCategory(lines.join(" ")),
    description: merchant ? `${merchant} 영수증` : "영수증 경비",
  };
}

export const receiptParserFallbackDate = today;
