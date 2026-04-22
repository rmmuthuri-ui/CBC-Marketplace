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
};

type VerifyResponse = {
  paid: boolean;
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

export function MpesaPaymentForm({
  defaultAmount = 1,
  resourceId,
}: MpesaPaymentFormProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
      }
    };
  }, []);

  function startVerificationPolling(phoneNumber: string) {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
    }

    pollTimer.current = window.setInterval(async () => {
      try {
        const response = await fetch("/api/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phoneNumber,
            resourceId,
          }),
        });

        const raw = await response.text();
        const data = parseJsonSafe<VerifyResponse>(raw);

        if (data?.paid) {
          if (pollTimer.current) {
            window.clearInterval(pollTimer.current);
            pollTimer.current = null;
          }

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
          amount: Number(amount),
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

      setIsWaitingForConfirmation(true);
      setIsError(false);
      setMessage("Complete payment on your phone.");
      startVerificationPolling(phone);
    } catch {
      setIsError(true);
      setMessage("Could not connect to payment service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload() {
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

      <div className="space-y-1">
        <label htmlFor="mpesa-amount" className="text-sm font-medium text-slate-700">
          Amount (KES)
        </label>
        <input
          id="mpesa-amount"
          type="number"
          min="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
          disabled={isPaid || isLoading || isWaitingForConfirmation}
          required
        />
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
            className="rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Download Resource
          </button>
        )}
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
