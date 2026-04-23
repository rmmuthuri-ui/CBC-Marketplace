"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type MpesaPaymentFormProps = {
  defaultAmount?: number;
  resourceId: string;
};

type ApiResponse = {
  error?: string;
  CustomerMessage?: string;
  ResponseDescription?: string;
  CheckoutRequestID?: string;
};

type VerifyResponse = {
  paid: boolean;
};

type StkQueryResponse = {
  error?: string;
  ResultCode?: string;
  ResultDesc?: string;
};

function parseJsonSafe<T>(raw: string): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function MpesaPaymentForm({
  defaultAmount = 1,
  resourceId,
}: MpesaPaymentFormProps) {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollAttempts = useRef(0);
  const maxPollAttempts = 40;

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function checkPaymentStatus(phoneNumber: string, incomingCheckoutRequestId?: string) {
    const effectiveCheckoutRequestId =
      incomingCheckoutRequestId ?? (checkoutRequestId || undefined);

    const response = await fetch("/api/verify-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: phoneNumber,
        resourceId,
        checkoutRequestId: effectiveCheckoutRequestId,
      }),
    });

    const raw = await response.text();
    const data = parseJsonSafe<VerifyResponse>(raw);

    if (!response.ok) {
      throw new Error("Verification request failed.");
    }

    return Boolean(data?.paid);
  }

  async function checkStkPushStatus(incomingCheckoutRequestId?: string) {
    const effectiveCheckoutRequestId =
      incomingCheckoutRequestId ?? (checkoutRequestId || undefined);

    const response = await fetch("/api/stkpush-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkoutRequestId: effectiveCheckoutRequestId ?? undefined,
        phone,
        resourceId,
      }),
    });

    const raw = await response.text();
    const data = parseJsonSafe<StkQueryResponse>(raw);

    if (!response.ok) {
      throw new Error(data?.error || "Could not check STK status.");
    }

    return data;
  }

  function startVerificationPolling(phoneNumber: string, incomingCheckoutRequestId?: string) {
    stopPolling();
    pollAttempts.current = 0;

    pollTimer.current = window.setInterval(async () => {
      pollAttempts.current += 1;

      if (pollAttempts.current > maxPollAttempts) {
        stopPolling();
        setIsWaitingForConfirmation(false);
        setIsError(true);
        setMessage("Payment confirmation timed out. Tap Check payment status to try again.");
        return;
      }

      try {
        // Query Safaricom every 9 seconds to expose explicit ResultDesc failures.
        if (pollAttempts.current % 3 === 0) {
          const queryResult = await checkStkPushStatus(incomingCheckoutRequestId);
          const resultCode = queryResult?.ResultCode?.trim();
          if (resultCode && resultCode !== "0") {
            stopPolling();
            setIsWaitingForConfirmation(false);
            setIsError(true);
            setMessage(
              queryResult?.ResultDesc ||
                "M-PESA declined the request. Please confirm details and try again.",
            );
            return;
          }
        }

        const paid = await checkPaymentStatus(phoneNumber, incomingCheckoutRequestId);
        if (paid) {
          stopPolling();
          setIsPaid(true);
          setIsWaitingForConfirmation(false);
          setMessage("Payment confirmed. Download is ready.");
          setIsError(false);
        }
      } catch {
        // keep polling
      }
    }, 3000);
  }

  async function handleCheckPaymentStatus() {
    if (!phone) {
      setIsError(true);
      setMessage("Enter the phone number used for payment first.");
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      const queryResult = await checkStkPushStatus();
      const resultCode = queryResult?.ResultCode?.trim();
      if (resultCode && resultCode !== "0") {
        setIsError(true);
        setMessage(
          queryResult?.ResultDesc ||
            "M-PESA declined the request. Please confirm details and try again.",
        );
        return;
      }

      let paid = await checkPaymentStatus(phone);
      if (!paid) {
        await delay(1200);
        paid = await checkPaymentStatus(phone);
      }
      if (!paid) {
        await delay(1200);
        paid = await checkPaymentStatus(phone);
      }

      if (paid) {
        setIsPaid(true);
        setIsWaitingForConfirmation(false);
        setMessage("Payment confirmed. Download is ready.");
      } else {
        setMessage("No confirmed payment yet. Complete the M-PESA prompt and try again.");
      }
    } catch {
      setIsError(true);
      setMessage("Could not verify payment right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/stkpush", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          resourceId,
        }),
      });

      const raw = await response.text();
      const data = parseJsonSafe<ApiResponse>(raw);

      if (!response.ok) {
        setIsError(true);
        setMessage(data?.error ?? "Payment request failed.");
        return;
      }

      setCheckoutRequestId(data?.CheckoutRequestID ?? "");
      setIsWaitingForConfirmation(true);
      setIsError(false);
      setMessage("STK push sent. Complete payment on your phone. We are tracking status.");
      startVerificationPolling(phone, data?.CheckoutRequestID);
    } catch {
      setIsError(true);
      setMessage("Could not connect to payment service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload() {
    setIsDownloading(true);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          resourceId,
        }),
      });

      const raw = await response.text();
      const data = parseJsonSafe<{ url?: string; error?: string }>(raw);

      if (!response.ok || !data?.url) {
        setIsError(true);
        setMessage(data?.error ?? "Unable to generate download link.");
        return;
      }

      setIsError(false);
      window.open(data.url, "_blank");
    } catch {
      setIsError(true);
      setMessage("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Pay with M-PESA</h2>
      <p className="text-sm text-slate-600">
        {isPaid
          ? "After payment: Download"
          : isWaitingForConfirmation
            ? "Waiting for confirmation..."
            : "Before payment: View + Buy"}
      </p>

      <div className="space-y-1">
        <label htmlFor="mpesa-phone" className="text-sm font-medium text-slate-700">
          Phone number
        </label>
        <input
          id="mpesa-phone"
          type="tel"
          placeholder="07XXXXXXXX or +254XXXXXXXXX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
          disabled={isPaid || isLoading || isWaitingForConfirmation}
          required
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Amount (KES): <span className="font-semibold">{defaultAmount}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.open(`/product/${resourceId}`, "_blank")}
          className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
        {!isPaid ? (
          <button
            type="submit"
            disabled={isLoading || isWaitingForConfirmation}
            className="rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Processing payment..." : "Buy"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isDownloading ? "Preparing download..." : "Download Resource"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCheckPaymentStatus}
          disabled={isLoading || isPaid}
          className="rounded-md border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Check payment status
        </button>
      </div>

      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            isError
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
