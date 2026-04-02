import type { Order } from "../types";

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function printReceipt(order: Order) {
  const items = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:4px 8px 4px 0">${item.quantity}× ${esc(item.itemName)}${item.notes ? `<div style="font-size:11px;color:#888">${esc(item.notes)}</div>` : ""}</td>
          <td style="padding:4px 0;text-align:right">Bs. ${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Recibo — Mesa ${order.table?.number ?? "?"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Plus Jakarta Sans", system-ui, sans-serif; font-size: 13px; color: #111; max-width: 320px; margin: 0 auto; padding: 24px 16px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .sub { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
    .total-row td { font-weight: 700; font-size: 15px; padding-top: 4px; }
    .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <h1>Restaurante</h1>
  <div class="sub">
    Mesa ${order.table?.number ?? "?"} &nbsp;·&nbsp;
    Pedido #${esc(order.id.slice(0, 8))}<br>
    ${esc(new Date(order.createdAt).toLocaleString())}
    ${order.waiter ? `<br>Atendido por: ${esc(order.waiter.name)}` : ""}
  </div>
  <div class="divider"></div>
  <table>${items}</table>
  <div class="divider"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">Bs. ${parseFloat(order.subtotal).toFixed(2)}</td></tr>
    ${order.discountType !== "none" && parseFloat(order.discountAmount) > 0
      ? `<tr><td>Descuento${order.discountType === "percentage" ? ` (${parseFloat(order.discountValue)}%)` : ""}${order.discountReason ? ` — ${esc(order.discountReason)}` : ""}</td><td style="text-align:right;color:#16a34a">−Bs. ${parseFloat(order.discountAmount).toFixed(2)}</td></tr>`
      : ""}
    <tr><td>Impuesto</td><td style="text-align:right">Bs. ${parseFloat(order.tax).toFixed(2)}</td></tr>
    <tr class="total-row"><td>Total</td><td style="text-align:right">Bs. ${parseFloat(order.total).toFixed(2)}</td></tr>
  </table>
  ${order.notes ? `<div class="divider"></div><div style="font-size:12px;color:#666">Nota: ${esc(order.notes)}</div>` : ""}
  <div class="footer">¡Gracias!</div>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
