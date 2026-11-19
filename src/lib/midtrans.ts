import crypto from "crypto";
import midtransClient from "midtrans-client";

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

export const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

export const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

export interface ChargeQrisParams {
  orderId: string;
  grossAmount: number;
  customerName: string;
}

export async function chargeQris({
  orderId,
  grossAmount,
  customerName,
}: ChargeQrisParams) {
  const parameter = {
    payment_type: "qris",
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: customerName || "Pelanggan Laundry",
    },
    qris: {
      acquirer: "gopay",
    },
    custom_expiry: {
      expiry_duration: 15,
      unit: "minute",
    },
  };

  const response = await coreApi.charge(parameter);
  return {
    qrString: response.qr_string as string,
    expiryTime: response.expiry_time
      ? new Date(response.expiry_time)
      : new Date(Date.now() + 15 * 60 * 1000),
    raw: response,
  };
}

export async function createSnapTransaction({
  orderId,
  grossAmount,
  customerName,
}: ChargeQrisParams) {
  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: customerName || "Pelanggan Laundry",
    },
  };

  const response = await snap.createTransaction(parameter);
  return {
    token: response.token as string,
    redirectUrl: response.redirect_url as string,
    raw: response,
  };
}

export async function getMidtransStatus(orderId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (coreApi as any).transaction.status(orderId);
}

export async function cancelMidtransTransaction(orderId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (coreApi as any).transaction.cancel(orderId);
}

export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const secretKey =
    process.env.MIDTRANS_SIGNATURE_KEY || process.env.MIDTRANS_SERVER_KEY || "";
  const raw = `${params.orderId}${params.statusCode}${params.grossAmount}${secretKey}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  return expected === params.signatureKey;
}
