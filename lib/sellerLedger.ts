import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SELLER_COMMISSION_RATE = 0;

type PaymentRow = {
  id: string;
  resource_id: string;
  amount: number;
};

type SellerResourceRow = {
  seller_email: string;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function ensureSellerLedgerEntryForPayment(paymentId: string): Promise<void> {
  if (!paymentId) {
    return;
  }

  const paymentLookup = await supabaseAdmin
    .from("payments")
    .select("id, resource_id, amount, status")
    .eq("id", paymentId)
    .eq("status", "paid")
    .maybeSingle();

  if (paymentLookup.error || !paymentLookup.data) {
    return;
  }

  const payment = paymentLookup.data as PaymentRow;
  if (!payment.resource_id) {
    return;
  }

  const existingLedger = await supabaseAdmin
    .from("seller_ledger")
    .select("id")
    .eq("source_payment_id", payment.id)
    .maybeSingle();

  if (existingLedger.data) {
    return;
  }

  const sellerResourceLookup = await supabaseAdmin
    .from("seller_resources")
    .select("seller_email")
    .eq("published_product_id", payment.resource_id)
    .eq("review_status", "approved")
    .maybeSingle();

  if (sellerResourceLookup.error || !sellerResourceLookup.data?.seller_email) {
    return;
  }

  const sellerResource = sellerResourceLookup.data as SellerResourceRow;
  const grossAmount = Number(payment.amount) || 0;
  const commissionAmount = roundCurrency(grossAmount * SELLER_COMMISSION_RATE);
  const netAmount = roundCurrency(grossAmount - commissionAmount);

  await supabaseAdmin.from("seller_ledger").insert({
    seller_email: sellerResource.seller_email,
    source_payment_id: payment.id,
    resource_id: payment.resource_id,
    gross_amount: grossAmount,
    commission_amount: commissionAmount,
    net_amount: netAmount,
    entry_type: "sale",
    status: "accrued",
  });
}
