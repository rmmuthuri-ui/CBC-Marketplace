"use client";

import { FormEvent, useState } from "react";

type MpesaPaymentFormProps = {
  defaultAmount?: number;
};

type ApiResponse = {
  error?: string;
  CustomerMessage?: string;
  ResponseDescription?: string;
};

export function MpesaPaymentForm({ defaultAmount = 1 }: MpesaPaymentFormProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setIsError(true);
        setMessage(data.error ?? "Payment request failed.");
        return;
      }

      setIsError(false);
      setMessage(
        data.CustomerMessage ??
          data.ResponseDescription ??
          "STK push sent successfully. Check your phone to complete payment.",
      );
    } catch {
      setIsError(true);
      setMessage("Could not connect to payment service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Pay with M-PESA</h2>

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
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Processing..." : "Pay with M-PESA"}
      </button>

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
