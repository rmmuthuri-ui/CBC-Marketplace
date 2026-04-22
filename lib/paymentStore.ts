export type PaymentRecord = {
  phone: string;
  resourceId: string;
  status: "pending" | "paid";
};

const payments: PaymentRecord[] = [];

export function addPendingPayment(phone: string, resourceId: string) {
  payments.push({
    phone: phone.trim(),
    resourceId: resourceId.trim(),
    status: "pending",
  });
}

export function markPaymentPaid(phone: string, resourceId: string) {
  const normalizedPhone = phone.trim();
  const normalizedResourceId = resourceId.trim();

  const pending = payments.find(
    (item) =>
      item.phone === normalizedPhone &&
      item.resourceId === normalizedResourceId &&
      item.status === "pending",
  );

  if (pending) {
    pending.status = "paid";
    return;
  }

  payments.push({
    phone: normalizedPhone,
    resourceId: normalizedResourceId,
    status: "paid",
  });
}

export function getPayment(phone: string, resourceId: string): PaymentRecord | undefined {
  const normalizedPhone = phone.trim();
  const normalizedResourceId = resourceId.trim();
  return payments.find(
    (item) => item.phone === normalizedPhone && item.resourceId === normalizedResourceId,
  );
}
