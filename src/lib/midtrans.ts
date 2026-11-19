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
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return {
      qrString: `00020101021226580014ID.CO.QRIS.WWW0215ID1020000000001520454995303360540${grossAmount}5802ID5916LAUNDRY TRICOINS6007JAKARTA62180114${orderId}6304ABCD`,
      qrUrl: `https://api.sandbox.midtrans.com/v2/qris/${orderId}/qr-code`,
      expiryTime: new Date(Date.now() + 15 * 60 * 1000),
      raw: { mock: true, order_id: orderId },
    };
  }

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
  const qrAction = Array.isArray(response.actions)
    ? response.actions.find(
        (a: { name?: string; url?: string }) =>
          a.name === "generate-qr-code" || a.name === "generate-qr-code-v2"
      )
    : null;

  return {
    qrString: response.qr_string as string,
    qrUrl: (qrAction?.url as string) || null,
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
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return { order_id: orderId, transaction_status: "pending" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (coreApi as any).transaction.status(orderId);
}

export async function cancelMidtransTransaction(orderId: string) {
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return { order_id: orderId, status_code: "200" };
  }
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
