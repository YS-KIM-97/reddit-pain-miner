export type ExpenseDraft = {
  merchant: string;
  date: string;
  amount: string;
  currency: "KRW" | "USD" | "VND";
  category: string;
  description: string;
};

const FINAL_TOTAL_WORDS =
  /\btotal\b|결[재제]\s*(?:대상\s*)?금액|합\s*계(?:\s*금액)?/i;
const TOTAL_WORDS =
  /total|amount|grand|tong\s*cong|합\s*계|총\s*(?:액|구매액|매출액)|결[재제]|받을금액|판매금액|거래금액/i;
const TAX_WORDS = /과\s*세|부\s*가\s*세|면\s*세|공급가액/i;
const NON_MERCHANT_WORDS =
  /영수증|receipt|고객용|사업자|대표자|전화|tel|주소|date|일시|카드|판매|상품명|품명|수량|단가|금액|교환|환불|결제|지참|구매|신선|고객센터|p[o0]s/i;

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
    ...text.matchAll(/(?:19|20)[0-9OIl]{6}/g),
    ...text.matchAll(
      /\b[27][0O][0-9OIl]{2}\s*(?:[./-]\s*|\s+)[0-1OIl]?[0-9OIl]\s*[./-]\s*[0-3OIlbB][0-9OIlbB]\b/g,
    ),
    ...text.matchAll(
      /(?:^|\s)[0-9OIl]{2}\s*[./-]\s*[0-1OIl]?[0-9OIl]\s*[./-]\s*[0-3OIlbB][0-9OIlbB](?=\s|$)/g,
    ),
  ];

  for (const candidate of candidates) {
    const parts = normalizeOcrDigits(candidate[0]).match(/\d+/g);
    if (!parts || (parts.length < 3 && parts[0]?.length !== 8)) continue;
    let [year, month, day] = parts.map(Number);
    if (parts.length === 1 && parts[0].length === 8) {
      year = Number(parts[0].slice(0, 4));
      month = Number(parts[0].slice(4, 6));
      day = Number(parts[0].slice(6, 8));
    } else if (year < 100) {
      year += 2000;
    } else if (year >= 7000 && year <= 7099) {
      year -= 5000;
    }
    if (!validDate(year, month, day)) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

export function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (
    /coffee|cafe|restaurant|food|steakhouse|starbucks|7\s*eleven|(?:^|\s)cu(?:\s|$)|gs\s*25|식당|카페|커피|스테이크|스타벅스|김밥|치킨|식사|편의점|세븐일레븐|바닐라|초코/.test(
      lower,
    )
  ) {
    return "식비";
  }
  if (
    /taxi|bus|train|metro|parking|택시|버스|지하철|주차|철도|교통공사|기후동행카드|충전/.test(
      lower,
    )
  ) {
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
    if (branch) return branch.replace(/점점$/, "점");
  }
  return "";
}

export function extractMerchant(lines: string[]) {
  const joined = lines.join(" ");
  const branch = extractBranch(lines);
  const knownBrands: Array<[RegExp, string]> = [
    [/7\s*[-.]?\s*eleven|세븐.{0,4}(?:일|릴)?레|일레븐|1577[-\s]?0711/i, "세븐일레븐"],
    [/(?:^|\s)gs\s*25(?:\s|$)|지에스\s*25/i, "GS25"],
    [/(?:^|\s)cu(?:\s|$)|씨유/i, "CU"],
    [/emart\s*24|이마트\s*24/i, "이마트24"],
    [/starbucks|스타벅스/i, "스타벅스"],
    [/lotte\s*mart|롯데\s*마트/i, "롯데마트"],
    [/다이소|daiso/i, "다이소"],
    [/기후동행카드/i, "기후동행카드 충전"],
  ];
  const known = knownBrands.find(([pattern]) => pattern.test(joined));
  if (known) return branch ? `${known[1]} ${branch}` : known[1];

  const labeled = lines
    .map((line) =>
      line.match(/(?:상호|가맹점명|매장명|사업자명)\s*[:：]?\s*([^|]{2,36})/i)?.[1]?.trim(),
    )
    .find((value) => value && !NON_MERCHANT_WORDS.test(value));
  if (labeled) return labeled.replace(/\s{2,}/g, " ");

  const receiptBoundary = lines.findIndex(
    (line) => /\b(?:19|20)\d{2}[./\s-]|\bp[o0]s\s*:/i.test(line),
  );
  const headerLines = receiptBoundary > 0 ? lines.slice(0, receiptBoundary) : lines;
  return (
    headerLines.find(
      (line) =>
        line.length >= 3 &&
        line.length <= 36 &&
        !NON_MERCHANT_WORDS.test(line) &&
        !/^\W?\d/.test(line) &&
        /[가-힣A-Za-z]/.test(line) &&
        (/[가-힣]{2,}/.test(line) || /[A-Za-z]{3,}/.test(line)) &&
        (line.match(/[가-힣A-Za-z]/g)?.length ?? 0) / line.length >= 0.55,
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

function parsedGroupedNumber(value: string) {
  const normalized = normalizeOcrDigits(value).replace(/[₩￦Ww\s]/g, "");
  const parts = normalized.split(/[,，.]/);
  if (parts.length === 2 && parts[1].length > 0 && parts[1].length < 3) {
    return Number(`${parts[0]}${parts[1].padEnd(3, "0")}`);
  }
  return parsedNumber(value);
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

function extractKrwAmount(lines: string[]) {
  const candidates: AmountCandidate[] = [];
  const amountPattern =
    /[₩￦Ww]?\s*[0-9OIl]{1,4}(?:\s*[,，.]\s*[0-9OIl]{1,3})+|[0-9OIl]{1,8}\s*원/g;

  lines.forEach((line, lineIndex) => {
    const matches = [...(line.match(amountPattern) ?? [])];
    if (TOTAL_WORDS.test(line)) {
      const plainTotal = line.match(/(?:^|\s)([0-9OIl]{3,8})(?:\s*(?:원|₩|￦)|\s*$)/i)?.[1];
      if (plainTotal) matches.push(plainTotal);
    }
    for (const match of matches) {
      const compactMatch = normalizeOcrDigits(match).replace(/[₩￦Ww\s]/g, "");
      const groupedParts = compactMatch.split(/[,，.]/);
      const repairedGrouping = groupedParts.length === 2 && groupedParts[1].length < 3;
      const value = parsedGroupedNumber(match);
      if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) continue;
      const hasCurrency = /^[₩￦Ww]/.test(match.trim());
      let score = (lineIndex / Math.max(lines.length - 1, 1)) * 6 + 2;
      const nearbyLabel = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 1).join(" ");
      if (FINAL_TOTAL_WORDS.test(line)) score += 20;
      else if (FINAL_TOTAL_WORDS.test(nearbyLabel)) score += 15;
      else if (TOTAL_WORDS.test(line)) score += 12;
      else if (TOTAL_WORDS.test(nearbyLabel)) score += 9;
      if (hasCurrency) score += 6;
      if (TAX_WORDS.test(line)) score -= 4;
      if (/사업자|전화|tel|승인|카드번호|품번/i.test(line)) score -= 12;
      if (/\d{2,4}[./-]\s*\d{1,2}/.test(line) || /\d{1,2}:\d{2}/.test(line)) score -= 10;
      if (repairedGrouping) score += 8;
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

  const occurrenceCounts = new Map<number, number>();
  for (const candidate of candidates) {
    occurrenceCounts.set(candidate.value, (occurrenceCounts.get(candidate.value) ?? 0) + 1);
  }
  const largestRepeated = Math.max(
    0,
    ...[...occurrenceCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value),
  );
  const correctedWithSumSupport = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.correctedCurrency && hasSumSupport(candidate.value, candidates),
      )
      .map((candidate) => candidate.value),
  );
  for (const candidate of candidates) {
    if (correctedWithSumSupport.has(candidate.value)) {
      candidate.score += 10;
    }
    const repeats = occurrenceCounts.get(candidate.value) ?? 1;
    if (repeats > 1) candidate.score += Math.min(12, (repeats - 1) * 6);
    if (!correctedWithSumSupport.size && candidate.value === largestRepeated) {
      candidate.score += 8;
    }
  }

  candidates.sort((left, right) => right.score - left.score || right.lineIndex - left.lineIndex);
  return candidates[0]?.value ?? 0;
}


function extractUsdValue(line: string) {
  const matches = line.match(/\$?\s*\d{1,4}(?:[.,\s]\d{2})\b/g) ?? [];
  const match = matches.at(-1);
  if (!match) return null;
  const normalized = match.replace(/[^\d.,\s]/g, "").trim().replace(/\s+(?=\d{2}$)/, ".");
  const value = Number(normalized.replace(/,/g, "."));
  return Number.isFinite(value) ? value : null;
}

function repairUsdComponent(value: number, ceiling: number) {
  if (value <= ceiling) return value;
  const [integerPart, decimalPart = "00"] = value.toFixed(2).split(".");
  const variants = [...integerPart].map((_, index) =>
    Number(`${integerPart.slice(0, index)}${integerPart.slice(index + 1)}.${decimalPart}`),
  );
  return variants.filter((candidate) => candidate > 0 && candidate <= ceiling).sort((a, b) => b - a)[0] ?? value;
}

function extractUsdAmount(lines: string[]) {
  const readLabel = (pattern: RegExp) => {
    const line = lines.find((candidate) => pattern.test(candidate));
    return line ? extractUsdValue(line) : null;
  };
  const subtotal = readLabel(/\bsubtotal\b/i);
  const tax = readLabel(/\btax\b/i);
  const rawTip = readLabel(/\btip\b/i);
  const total = readLabel(/\btotal\b/i);

  if (subtotal !== null && tax !== null && rawTip !== null) {
    const tip = repairUsdComponent(rawTip, subtotal);
    const calculated = Math.round((subtotal + tax + tip) * 100) / 100;
    if (total === null || Math.abs(total - calculated) > Math.max(1, calculated * 0.03)) {
      return calculated;
    }
  }
  if (total !== null) return total;

  const candidates = lines
    .flatMap((line) => (line.match(/\$\s*\d{1,4}(?:[.,]\d{2})/g) ?? []).map(extractUsdValue))
    .filter((value): value is number => value !== null);
  return candidates.length ? Math.max(...candidates) : 0;
}

export function extractAmount(lines: string[], currency: ExpenseDraft["currency"] = "KRW") {
  return currency === "USD" ? extractUsdAmount(lines) : extractKrwAmount(lines);
}

export function parseReceipt(text: string): ExpenseDraft {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const merchant = extractMerchant(lines);
  const dollarAmounts = text.match(/\$\s*\d+(?:[.,]\d{2})/g) ?? [];
  const currency: ExpenseDraft["currency"] =
    dollarAmounts.length >= 2 ||
    (dollarAmounts.length === 1 && /\b(?:subtotal|tax|tip|total)\b/i.test(text))
    ? "USD"
    : /(?:lotte\s*mart\s*da\s*nang|tong\s*cong|tien\s*tra|vnd|₫)/i.test(text)
      ? "VND"
      : "KRW";
  const amount = extractAmount(lines, currency);

  return {
    merchant,
    date: extractDate(text),
    amount: amount ? (currency === "USD" ? amount.toFixed(2) : String(Math.round(amount))) : "",
    currency,
    category: inferCategory(`${merchant} ${lines.join(" ")}`),
    description: merchant ? `${merchant} 영수증` : "영수증 경비",
  };
}

type OcrReceiptPass = {
  text: string;
  confidence: number;
};

function normalizedField(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function selectSupportedValue(values: string[]) {
  const present = values.filter(Boolean);
  if (!present.length) return "";
  const support = new Map<string, { value: string; count: number; first: number }>();
  present.forEach((value, index) => {
    const key = normalizedField(value);
    const current = support.get(key);
    support.set(key, current ? { ...current, count: current.count + 1 } : { value, count: 1, first: index });
  });
  return [...support.values()].sort(
    (left, right) => right.count - left.count || left.first - right.first || right.value.length - left.value.length,
  )[0].value;
}

function agreement(values: string[], selected: string) {
  const present = values.filter(Boolean);
  if (!selected || !present.length) return 0;
  const key = normalizedField(selected);
  return present.filter((value) => normalizedField(value) === key).length / present.length;
}

export function analyzeReceiptPasses(passes: OcrReceiptPass[]) {
  const usable = passes.filter((pass) => pass.text.trim());
  if (!usable.length) return { draft: parseReceipt(""), confidence: 0 };
  const combinedText = usable.map((pass) => pass.text).join("\n");
  const parsed = [parseReceipt(combinedText), ...usable.map((pass) => parseReceipt(pass.text))];
  const merchantValues = parsed.map((draft) => draft.merchant);
  const dateValues = parsed.map((draft) => draft.date);
  const amountValues = parsed.map((draft) =>
    draft.amount ? `${draft.currency}:${draft.amount}` : "",
  );
  const merchant = selectSupportedValue(merchantValues);
  const date = selectSupportedValue(dateValues);
  const selectedAmount = selectSupportedValue(amountValues);
  const amountDraft = parsed.find(
    (draft) => draft.amount && `${draft.currency}:${draft.amount}` === selectedAmount,
  );
  const currency = amountDraft?.currency ?? parsed[0].currency;
  const amount = amountDraft?.amount ?? "";
  const category = inferCategory(`${merchant} ${combinedText}`);
  const draft: ExpenseDraft = {
    merchant,
    date,
    amount,
    currency,
    category,
    description: merchant ? `${merchant} 영수증` : "영수증 경비",
  };

  const merchantScore = merchant ? 0.55 + agreement(merchantValues, merchant) * 0.45 : 0;
  const dateScore = date ? 0.6 + agreement(dateValues, date) * 0.4 : 0;
  const amountScore = amount ? 0.65 + agreement(amountValues, selectedAmount) * 0.35 : 0;
  const ocrScore =
    usable.reduce((sum, pass) => sum + clampConfidence(pass.confidence), 0) / usable.length / 100;
  let confidence = Math.round(
    merchantScore * 22 + dateScore * 25 + amountScore * 43 + ocrScore * 10,
  );
  if (!amount) confidence = Math.min(confidence, 42);
  if (!merchant || !date) confidence = Math.min(confidence, 78);
  return { draft, confidence };
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export const receiptParserFallbackDate = today;
