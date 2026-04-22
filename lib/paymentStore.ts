export type PaidPayment = {
  phone: string;
  amount: number;
  resourceId: string;
  status: "paid";
  checkoutRequestId?: string;
};

const pendingCheckoutToResource = new Map<string, string>();
const paidPayments: PaidPayment[] = [];

function normalize(value: string): string {
  return value.trim();
}

export function rememberPendingCheckout(checkoutRequestId: string, resourceId: string) {
  pendingCheckoutToResource.set(normalize(checkoutRequestId), normalize(resourceId));
}

export function resolveResourceFromCheckout(checkoutRequestId: string): string | null {
  const key = normalize(checkoutRequestId);
  return pendingCheckoutToResource.get(key) ?? null;
}

export function markPaymentPaid(payment: PaidPayment) {
  const existing = paidPayments.find(
    (item) =>
      item.phone === payment.phone &&
      item.resourceId === payment.resourceId &&
      item.status === "paid",
  );

  if (existing) {
    return;
  }

  paidPayments.push(payment);
}

export function hasPaidForResource(phone: string, resourceId: string): boolean {
  const normalizedPhone = normalize(phone);
  const normalizedResourceId = normalize(resourceId);
  return paidPayments.some(
    (item) =>
      item.phone === normalizedPhone &&
      item.resourceId === normalizedResourceId &&
      item.status === "paid",
  );
}
