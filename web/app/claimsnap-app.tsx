"use client";

import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { ExpenseDraft, parseReceipt } from "@/lib/receipt-parser";

type SavedExpense = ExpenseDraft & { id: number; sourceResultId?: string };

type BatchResult = {
  id: string;
  fileName: string;
  previewUrl: string;
  draft: ExpenseDraft;
  confidence: number | null;
  saved: boolean;
};

type WebMCPContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<Record<string, unknown>>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const emptyDraft: ExpenseDraft = {
  merchant: "",
  date: "",
  amount: "",
  currency: "KRW",
  category: "기타",
  description: "",
};

const categories = ["식비", "교통", "사무용품", "숙박", "교육", "기타"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(amount: string, currency: ExpenseDraft["currency"]) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(amount));
}

export function ClaimSnapApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "review" | "saved">(
    "idle",
  );
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [batchPosition, setBatchPosition] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const registration = context.registerTool(
      {
        name: "create_expense_line",
        title: "경비 한 줄 만들기",
        description:
          "검증된 상호, 날짜, 금액, 분류, 설명으로 경비 한 줄을 만들고 화면의 확정 목록에 추가합니다.",
        inputSchema: {
          type: "object",
          properties: {
            merchant: { type: "string", minLength: 1 },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            amount: { type: "integer", minimum: 1 },
            category: { type: "string", enum: categories },
            description: { type: "string" },
          },
          required: ["merchant", "date", "amount", "category", "description"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input)) {
            throw new Error("경비 입력은 객체여야 합니다.");
          }
          const value = input as Record<string, unknown>;
          if (
            typeof value.merchant !== "string" ||
            !value.merchant.trim() ||
            typeof value.date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
            typeof value.amount !== "number" ||
            !Number.isInteger(value.amount) ||
            value.amount <= 0 ||
            typeof value.category !== "string" ||
            !categories.includes(value.category) ||
            typeof value.description !== "string"
          ) {
            throw new Error("경비 필드 형식이 올바르지 않습니다.");
          }
          const expense: SavedExpense = {
            id: Date.now(),
            merchant: value.merchant.trim(),
            date: value.date,
            amount: String(value.amount),
            currency: "KRW",
            category: value.category,
            description: value.description.trim(),
          };
          setDraft(expense);
          setSavedExpenses((current) => [expense, ...current]);
          setFileName("도구로 입력한 경비");
          setConfidence(null);
          setStatus("saved");
          return {
            status: "confirmed",
            expenseId: expense.id,
            merchant: expense.merchant,
            amount: value.amount,
            category: expense.category,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const updateDraft = (field: keyof ExpenseDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (selectedResultIndex >= 0) {
      setBatchResults((current) =>
        current.map((result, index) =>
          index === selectedResultIndex
            ? { ...result, draft: { ...result.draft, [field]: value }, saved: false }
            : result,
        ),
      );
      setStatus("review");
    }
  };

  const reset = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPreviewUrl(null);
    setFileName("");
    setDraft(emptyDraft);
    setProgress(0);
    setConfidence(null);
    setBatchResults([]);
    setSelectedResultIndex(-1);
    setBatchPosition({ current: 0, total: 0 });
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const useDemo = () => {
    reset();
    setDraft({
      merchant: "모닝 브루 성수",
      date: today(),
      amount: "12800",
      currency: "KRW",
      category: "식비",
      description: "클라이언트 미팅 커피",
    });
    setFileName("샘플 영수증");
    setPreviewUrl(null);
    setConfidence(94);
    setProgress(100);
    setStatus("review");
  };

  const selectBatchResult = (index: number, results = batchResults) => {
    const result = results[index];
    if (!result) return;
    setSelectedResultIndex(index);
    setDraft(result.draft);
    setPreviewUrl(result.previewUrl);
    setFileName(result.fileName);
    setConfidence(result.confidence);
    setProgress(100);
    setStatus(result.saved ? "saved" : "review");
  };

  const processFiles = async (incomingFiles: File[]) => {
    const supportedFiles = incomingFiles.filter(
      (file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024,
    );
    if (supportedFiles.length !== incomingFiles.length) {
      toast.warning("이미지가 아니거나 10MB를 넘는 파일은 제외했어요.");
    }
    const files = supportedFiles.slice(0, 10);
    if (supportedFiles.length > 10) toast.warning("한 번에 최대 10장까지 처리할 수 있어요.");
    if (!files.length) return;

    reset();
    const prepared = files.map((file, index) => ({
      file,
      id: `${Date.now()}-${index}`,
      previewUrl: URL.createObjectURL(file),
    }));
    objectUrlsRef.current = prepared.map((item) => item.previewUrl);
    setPreviewUrl(prepared[0].previewUrl);
    setFileName(prepared[0].file.name);
    setBatchPosition({ current: 1, total: prepared.length });
    setStatus("reading");
    setProgress(4);

    const results: BatchResult[] = [];
    let worker: import("tesseract.js").Worker | null = null;
    let ocrPass = 0;
    try {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      worker = await createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
        logger: (message) => {
          if (typeof message.progress === "number") {
            setProgress(Math.max(8, Math.round(((ocrPass + message.progress) / 2) * 100)));
          }
        },
      });

      for (let index = 0; index < prepared.length; index += 1) {
        const item = prepared[index];
        setBatchPosition({ current: index + 1, total: prepared.length });
        setPreviewUrl(item.previewUrl);
        setFileName(item.file.name);
        setProgress(4);
        ocrPass = 0;
        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
          const blockResult = await worker.recognize(item.file);
          ocrPass = 1;
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
          const columnResult = await worker.recognize(item.file);
          const text = `${columnResult.data.text}\n${blockResult.data.text}`.trim();
          results.push({
            id: item.id,
            fileName: item.file.name,
            previewUrl: item.previewUrl,
            draft: text ? parseReceipt(text) : { ...emptyDraft, description: item.file.name },
            confidence: Math.round(
              Math.max(blockResult.data.confidence, columnResult.data.confidence),
            ),
            saved: false,
          });
        } catch {
          results.push({
            id: item.id,
            fileName: item.file.name,
            previewUrl: item.previewUrl,
            draft: { ...emptyDraft, description: item.file.name },
            confidence: null,
            saved: false,
          });
        }
        setBatchResults([...results]);
      }
    } catch {
      for (const item of prepared.slice(results.length)) {
        results.push({
          id: item.id,
          fileName: item.file.name,
          previewUrl: item.previewUrl,
          draft: { ...emptyDraft, description: item.file.name },
          confidence: null,
          saved: false,
        });
      }
    } finally {
      await worker?.terminate();
    }

    setBatchResults(results);
    selectBatchResult(0, results);
    const failedCount = results.filter((result) => result.confidence === null).length;
    if (failedCount) {
      toast.warning(`${results.length}장 중 ${failedCount}장은 값을 직접 확인해 주세요.`);
    } else {
      toast.success(`${results.length}장을 모두 읽었어요. 결과를 확인해 주세요.`);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) void processFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) void processFiles(files);
  };

  const saveExpense = () => {
    if (!draft.merchant.trim() || !draft.date || !draft.amount.trim()) {
      toast.error("상호, 날짜, 금액을 확인해 주세요.");
      return;
    }
    const sourceResultId = batchResults[selectedResultIndex]?.id;
    setSavedExpenses((current) => {
      const existing = sourceResultId
        ? current.find((expense) => expense.sourceResultId === sourceResultId)
        : undefined;
      if (existing) {
        return current.map((expense) =>
          expense.id === existing.id ? { ...draft, id: existing.id, sourceResultId } : expense,
        );
      }
      return [{ ...draft, id: Date.now(), sourceResultId }, ...current];
    });
    if (selectedResultIndex >= 0) {
      setBatchResults((current) =>
        current.map((result, index) =>
          index === selectedResultIndex ? { ...result, draft, saved: true } : result,
        ),
      );
    }
    setStatus("saved");
    toast.success("경비 한 줄을 확정했습니다.");
  };

  const removeSavedExpense = (expense: SavedExpense) => {
    setSavedExpenses((current) => current.filter((item) => item.id !== expense.id));
    if (expense.sourceResultId) {
      setBatchResults((current) =>
        current.map((result) =>
          result.id === expense.sourceResultId ? { ...result, saved: false } : result,
        ),
      );
      const selectedResult = batchResults[selectedResultIndex];
      if (selectedResult?.id === expense.sourceResultId) setStatus("review");
    }
  };

  const formattedAmount = draft.amount
    ? formatMoney(draft.amount, draft.currency)
    : "금액 미확인";

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(30,77,216,.24)]">
              <ScanLine className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-[-0.03em]">ClaimSnap</p>
              <p className="text-xs font-medium text-muted-foreground">영수증에서 경비 한 줄까지</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            <LockKeyhole className="size-3.5 text-primary" aria-hidden="true" />
            이미지는 이 기기에서만 처리
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              새 경비 입력
            </p>
            <h1 className="max-w-2xl text-[clamp(2rem,4.5vw,4.4rem)] font-black leading-[0.98] tracking-[-0.06em] text-balance">
              찍고, 확인하고,
              <br />
              경비 한 줄로 끝내세요.
            </h1>
          </div>
          <p className="max-w-md text-base leading-7 text-muted-foreground">
            영수증의 상호·날짜·금액·분류를 자동으로 읽습니다. 결과를 확인한 뒤 바로 확정하세요.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
          <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_70px_rgba(15,34,58,.08)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="step-number">1</span>
                <div>
                  <h2 className="font-bold tracking-tight">영수증 올리기</h2>
                  <p className="text-sm text-muted-foreground">최대 10장 · 장당 10MB</p>
                </div>
              </div>
              {status !== "idle" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                  disabled={status === "reading"}
                  aria-label="영수증 초기화"
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {status === "idle" ? (
                <div
                  className="upload-zone group"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onFileChange}
                    className="sr-only"
                    id="receipt-upload"
                  />
                  <div className="scan-frame" aria-hidden="true">
                    <ReceiptText className="size-9" />
                  </div>
                  <div className="mt-6 text-center">
                    <p className="text-lg font-bold">영수증 여러 장을 여기에 놓으세요</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      한 번에 최대 10장을 선택해 순서대로 읽습니다.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 h-12 rounded-xl px-5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden="true" />
                    이미지 여러 장 선택
                  </Button>
                  <button
                    type="button"
                    onClick={useDemo}
                    className="mt-4 text-sm font-bold text-primary underline-offset-4 hover:underline"
                  >
                    이미지 없이 샘플로 체험
                  </button>
                </div>
              ) : (
                <div className="relative min-h-[440px] overflow-hidden rounded-[20px] bg-[#081a2b]">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="업로드한 영수증 미리보기"
                      className="h-[440px] w-full object-contain p-5"
                    />
                  ) : (
                    <div className="grid h-[440px] place-items-center text-center text-white">
                      <div>
                        <ReceiptText className="mx-auto size-16 text-[#b7ff4a]" />
                        <p className="mt-5 text-xl font-bold">샘플 영수증</p>
                        <p className="mt-2 text-sm text-white/60">실제 이미지는 전송되지 않습니다.</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {status === "reading"
                          ? `${batchPosition.current}/${batchPosition.total} · 글자를 읽고 있어요`
                          : batchResults.length > 1
                            ? `${selectedResultIndex + 1}/${batchResults.length} · 이미지 준비 완료`
                            : "이미지 준비 완료"}
                      </p>
                    </div>
                    {status === "reading" ? (
                      <LoaderCircle className="size-5 animate-spin text-primary" aria-label="처리 중" />
                    ) : (
                      <Check className="size-5 text-primary" aria-label="처리 완료" />
                    )}
                  </div>
                </div>
              )}
              {status === "reading" && (
                <div className="mt-5" aria-live="polite">
                  <div className="mb-2 flex justify-between text-sm font-semibold">
                    <span>
                      {batchPosition.current}/{batchPosition.total}번째 영수증 읽는 중
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5" />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card shadow-[0_24px_70px_rgba(15,34,58,.08)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="step-number">2</span>
                <div>
                  <h2 className="font-bold tracking-tight">내용 확인</h2>
                  <p className="text-sm text-muted-foreground">틀린 값은 바로 고칠 수 있어요</p>
                </div>
              </div>
              {status === "reading" ? (
                <span className="flex items-center gap-2 rounded-full bg-[#eaf3ff] px-3 py-1.5 text-xs font-bold text-primary">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  분석 중 {batchPosition.current}/{batchPosition.total} · {progress}%
                </span>
              ) : confidence !== null ? (
                <span className="rounded-full bg-[#eaf3ff] px-3 py-1.5 text-xs font-bold text-primary">
                  인식 신뢰도 {confidence}%
                </span>
              ) : null}
            </div>

            <div className="p-5 sm:p-7">
              {status === "idle" ? (
                <div className="grid min-h-[430px] place-items-center rounded-[20px] border border-dashed border-border bg-muted/50 px-7 text-center">
                  <div>
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-background text-muted-foreground shadow-sm">
                      <ArrowRight className="size-6" aria-hidden="true" />
                    </div>
                    <p className="mt-5 font-bold">영수증을 올리면 여기에 표시됩니다</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      자동 입력 후에도 모든 값을 직접 수정할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : status === "reading" ? (
                <div className="min-h-[430px] space-y-6" aria-live="polite">
                  <div className="rounded-[20px] border border-primary/20 bg-[#f2f7ff] p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-[0_10px_25px_rgba(30,77,216,.2)]">
                        <ScanLine className="size-5 animate-pulse" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {batchPosition.total > 1 && (
                          <p className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-primary">
                            영수증 {batchPosition.current}/{batchPosition.total}
                          </p>
                        )}
                        <p className="text-base font-black tracking-tight">
                          {progress < 50 ? "1차 · 글자 영역을 읽고 있어요" : "2차 · 날짜와 합계를 확인하고 있어요"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {progress < 50
                            ? "상호와 영수증 전체 문자를 찾는 중입니다."
                            : "다른 방식으로 한 번 더 읽어 숫자를 교차 검증합니다."}
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <Progress value={progress} className="h-2.5 flex-1" />
                          <span className="w-10 text-right text-sm font-black text-primary">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {["w-1/2", "w-2/3", "w-1/3"].map((width) => (
                    <div key={width}>
                      <div className="mb-2 h-3 w-16 animate-pulse rounded bg-muted" />
                      <div className={`h-11 ${width} animate-pulse rounded-xl bg-muted`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {batchResults.length > 1 && (
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => selectBatchResult(selectedResultIndex - 1)}
                        disabled={selectedResultIndex <= 0}
                        aria-label="이전 영수증"
                      >
                        <ChevronLeft aria-hidden="true" />
                      </Button>
                      <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-sm font-bold">{fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedResultIndex + 1}/{batchResults.length}번째 결과
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => selectBatchResult(selectedResultIndex + 1)}
                        disabled={selectedResultIndex >= batchResults.length - 1}
                        aria-label="다음 영수증"
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="merchant">상호</FieldLabel>
                      <Input
                        id="merchant"
                        value={draft.merchant}
                        onChange={(event) => updateDraft("merchant", event.target.value)}
                        placeholder="예: 모닝 브루 성수"
                        className="h-12 rounded-xl px-4"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="date">날짜</FieldLabel>
                      <Input
                        id="date"
                        type="date"
                        value={draft.date}
                        onChange={(event) => updateDraft("date", event.target.value)}
                        className="h-12 rounded-xl px-4"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="amount">금액</FieldLabel>
                      <div className="relative">
                        <Input
                          id="amount"
                          inputMode={draft.currency === "USD" ? "decimal" : "numeric"}
                          value={draft.amount}
                          onChange={(event) => {
                            const next = event.target.value.replace(
                              draft.currency === "USD" ? /[^\d.]/g : /[^\d]/g,
                              "",
                            );
                            updateDraft("amount", next);
                          }}
                          placeholder="0"
                          className="h-12 rounded-xl px-4 pr-10 text-lg font-bold"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                          {draft.currency === "USD" ? "$" : "원"}
                        </span>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel>분류</FieldLabel>
                      <Select
                        value={draft.category}
                        onValueChange={(value) => updateDraft("category", value)}
                      >
                        <SelectTrigger className="h-12 w-full rounded-xl px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="description">설명</FieldLabel>
                    <Input
                      id="description"
                      value={draft.description}
                      onChange={(event) => updateDraft("description", event.target.value)}
                      placeholder="이 경비를 알아볼 수 있는 설명"
                      className="h-12 rounded-xl px-4"
                    />
                    <FieldDescription>회계 내역에 표시되는 문구입니다.</FieldDescription>
                  </Field>

                  <div className="rounded-2xl bg-[#081a2b] p-4 text-white sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                      확정할 경비
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{draft.merchant || "상호 미확인"}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {draft.date || "날짜 미확인"} · {draft.category}
                        </p>
                      </div>
                      <p className="shrink-0 text-2xl font-black tracking-tight text-[#b7ff4a]">
                        {formattedAmount}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="h-14 w-full rounded-2xl text-base font-bold shadow-[0_14px_30px_rgba(30,77,216,.2)]"
                    onClick={saveExpense}
                    disabled={status === "saved"}
                  >
                    <FileCheck2 aria-hidden="true" />
                    {status === "saved" ? "확정 완료" : "경비 한 줄 확정"}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {batchResults.length > 1 && status !== "reading" && (
          <section className="mt-5 rounded-[28px] border border-border bg-card p-5 shadow-[0_24px_70px_rgba(15,34,58,.06)] sm:p-7">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-primary">일괄 인식 완료</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">영수증별 추출 결과</h2>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">
                {batchResults.filter((result) => result.saved).length}/{batchResults.length}건 확정
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {batchResults.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => selectBatchResult(index)}
                  className={`rounded-2xl border p-4 text-left transition hover:border-primary/50 hover:bg-[#f7faff] ${
                    index === selectedResultIndex
                      ? "border-primary bg-[#f2f7ff] shadow-[0_10px_30px_rgba(30,77,216,.1)]"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-bold text-muted-foreground">
                      {index + 1}. {result.fileName}
                    </p>
                    {result.saved ? (
                      <span className="shrink-0 rounded-full bg-[#e9ffd0] px-2 py-0.5 text-[11px] font-black text-[#315d00]">
                        확정
                      </span>
                    ) : result.confidence !== null ? (
                      <span className="shrink-0 text-xs font-bold text-primary">
                        {result.confidence}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 truncate font-black">
                    {result.draft.merchant || "상호 미확인"}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-muted-foreground">
                      {result.draft.date || "날짜 미확인"}
                    </span>
                    <span className="shrink-0 font-black">
                      {result.draft.amount
                        ? formatMoney(result.draft.amount, result.draft.currency)
                        : "금액 미확인"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {savedExpenses.length > 0 && (
          <section className="mt-5 rounded-[28px] border border-border bg-card p-5 shadow-[0_24px_70px_rgba(15,34,58,.06)] sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-primary">이번 세션</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">확정한 경비</h2>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">
                {savedExpenses.length}건
              </span>
            </div>
            <div className="divide-y divide-border">
              {savedExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-4 py-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-primary">
                    <ReceiptText className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{expense.merchant}</p>
                    <p className="text-sm text-muted-foreground">
                      {expense.date} · {expense.category}
                    </p>
                  </div>
                  <p className="font-black">{formatMoney(expense.amount, expense.currency)}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSavedExpense(expense)}
                    aria-label={`${expense.merchant} 경비 삭제`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        ClaimSnap MVP · 영수증 이미지는 업로드하거나 저장하지 않습니다.
      </footer>
    </main>
  );
}
