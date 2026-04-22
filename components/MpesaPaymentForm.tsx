"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type MpesaPaymentFormProps = {
  defaultAmount?: number;
  resourceId: string;
  resourceFile: string;
};

type ApiResponse = {
  error?: string;
  CustomerMessage?: string;
  ResponseDescription?: string;
};

type VerifyResponse = {
  paid?: boolean;
  fileUrl?: string | null;
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
  resourceFile,
}: MpesaPaymentFormProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  async function verifyPayment(phoneValue: string): Promise<VerifyResponse> {
    const response = await fetch("/api/verify-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: phoneValue,
        resourceId,
      }),
    });

    const raw = await response.text();
    return parseJsonSafe<VerifyResponse>(raw) ?? { paid: false };
  }

  function startPaymentPolling(phoneValue: string) {
    let attempts = 0;
    const maxAttempts = 40;
    setIsWaitingForConfirmation(true);

    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      try {
        const verification = await verifyPayment(phoneValue);
        if (verification.paid) {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setIsPaid(true);
          setDownloadUrl(
            verification.fileUrl ?? `/resources/${encodeURIComponent(resourceFile)}`,
          );
          setIsWaitingForConfirmation(false);
          setIsError(false);
          setMessage("Payment confirmed. You can now download this resource.");
          return;
        }
      } catch {
        // Continue polling until max attempts.
      }

      if (attempts >= maxAttempts) {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setIsWaitingForConfirmation(false);
        setIsError(true);
        setMessage("No payment confirmation yet. Complete payment on your phone and try again.");
      }
    }, 3000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRequestingPayment(true);
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

      setIsError(false);
      setMessage(
        data?.CustomerMessage ??
          data?.ResponseDescription ??
          "STK push sent successfully. Check your phone to complete payment.",
      );
      startPaymentPolling(phone);
    } catch {
      setIsError(true);
      setMessage("Could not connect to payment service. Please try again.");
    } finally {
      setIsRequestingPayment(false);
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
          disabled={isPaid || isWaitingForConfirmation}
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
          disabled={isPaid || isWaitingForConfirmation}
          required
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {!isPaid ? (
          <button
            type="submit"
            disabled={isRequestingPayment || isWaitingForConfirmation}
            className="rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRequestingPayment ? "Processing..." : "Pay with M-PESA"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              window.open(
                downloadUrl ?? `/resources/${encodeURIComponent(resourceFile)}`,
                "_blank",
              )
            }
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
