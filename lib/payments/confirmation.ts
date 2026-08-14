import { fetchRazorpayPayment, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import {
  validateCapturedPayment,
  type OnlinePaymentInvoice,
  type PaymentResult,
  type RazorpayPaymentEntity,
} from "@/lib/payments/settlement";

type ConfirmationDependencies = {
  verify?: typeof verifyCheckoutSignature;
  fetchPayment?: (paymentId: string) => Promise<RazorpayPaymentEntity>;
  persist: (invoiceId: string, payment: RazorpayPaymentEntity, actor: string) => Promise<PaymentResult>;
};

export async function confirmRazorpayInvoice(input: {
  invoice: OnlinePaymentInvoice;
  submittedOrderId: string;
  paymentId: string;
  signature: string;
  actor: string;
}, dependencies: ConfirmationDependencies): Promise<PaymentResult> {
  const { invoice, submittedOrderId, paymentId, signature, actor } = input;
  if (!invoice.gateway_order_id || submittedOrderId !== invoice.gateway_order_id) {
    return { ok: false, retryable: false, error: "Checkout order does not match this invoice." };
  }

  // Razorpay explicitly requires the server-stored order id here, never the
  // browser-provided value. The equality check above is an additional binding.
  const verify = dependencies.verify ?? verifyCheckoutSignature;
  if (!verify(invoice.gateway_order_id, paymentId, signature)) {
    return { ok: false, retryable: false, error: "Signature verification failed." };
  }

  if (["Paid", "Refunded"].includes(invoice.status)
      && invoice.gateway_payment_id === paymentId) {
    return {
      ok: true,
      data: {
        invoice_id: invoice.id,
        invoice_num: null,
        amount: invoice.amount,
        status: invoice.status,
        idempotent_replay: true,
      },
    };
  }
  if (invoice.status !== "Unpaid") {
    return { ok: false, retryable: false, error: "Invoice is not eligible for payment." };
  }

  let payment: RazorpayPaymentEntity;
  try {
    payment = await (dependencies.fetchPayment ?? fetchRazorpayPayment)(paymentId);
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : "Could not verify payment status with Razorpay.",
    };
  }
  const validation = validateCapturedPayment(invoice, payment);
  if (!validation.ok) return { ok: false, retryable: false, error: validation.error };
  return dependencies.persist(invoice.id, payment, actor);
}
