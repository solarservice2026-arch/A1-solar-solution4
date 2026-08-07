const esc = (value) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const inr = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );

const parseQty = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = String(val).match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? parseFloat(match[0]) : 0;
};

const amountWords = (value) => {
  const n = Math.round(Number(value || 0));
  if (!Number.isFinite(n) || n < 0) return "";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ],
  tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const under100 = (x) =>
    x < 20 ? (ones[x] ?? "") : `${tens[Math.floor(x / 10)] ?? ""}${x % 10 ? ` ${ones[x % 10] ?? ""}` : ""}`,
  under1000 = (x) =>
    x < 100 ? under100(x) : `${ones[Math.floor(x / 100)] ?? ""} Hundred${x % 100 ? ` ${under100(x % 100)}` : ""}`;
  const parts = [];
  let left = n;
  const crore = Math.floor(left / 10000000); left %= 10000000;
  const lakh = Math.floor(left / 100000); left %= 100000;
  const thousand = Math.floor(left / 1000); left %= 1000;
  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under100(lakh)} Lakh`);
  if (thousand) parts.push(`${under100(thousand)} Thousand`);
  if (left) parts.push(under1000(left));
  return `${parts.join(" ") || "Zero"} Only`;
};

/** Shared CSS for all three documents — invoice-style layout */
const sharedCss = () => `
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font:12px Arial,Helvetica,sans-serif;color:#333;background:#e8e8e8}
.sheet{width:210mm;min-height:297mm;margin:auto;background:#fff}
/* ─── Hero Banner ─── */
.hero-container{position:relative;width:100%;height:68mm;overflow:hidden}
.hero{width:100%;height:100%;display:block;object-fit:cover;object-position:50% 40%;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.hero-text{position:absolute;top:12%;left:50%;transform:translateX(-50%);color:#ff0000;font-size:42px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;letter-spacing:-0.5px;z-index:2}
.hero-patch{position:absolute;top:0;right:0;width:26%;height:46%;background:linear-gradient(135deg,#72aee6 0%,#468bcd 50%,#347dbd 100%);z-index:2;print-color-adjust:exact;-webkit-print-color-adjust:exact}
/* ─── Sub-header row ─── */
.doc-header{display:grid;align-items:center;padding:4mm 14mm;border-bottom:1px solid #dde1ea;gap:0}
.doc-header.cols-4{grid-template-columns:44mm 1fr 34mm 36mm}
.doc-header.cols-3{grid-template-columns:44mm 1fr 60mm}
.logo-brand{display:block;height:18mm;width:auto;max-width:42mm;object-fit:contain;background:transparent;border-radius:50%;mix-blend-mode:multiply;filter:contrast(180%) brightness(120%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
/* ─── Agreement logo header ─── */
.agr-logo-header{display:flex;align-items:center;justify-content:flex-start;padding:4mm 14mm 2mm;border-bottom:1px solid #dde1ea;margin-bottom:3mm}
.agr-logo-header img{height:16mm;width:auto;object-fit:contain;background:transparent;border-radius:50%;mix-blend-mode:multiply;filter:contrast(180%) brightness(120%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.doc-title{text-align:center}
.doc-title h1{margin:0;font-size:22px;font-weight:900;letter-spacing:.06em;color:#1a3a6b}
.doc-title b{display:block;color:#586bc5;font-size:12px;margin-top:2px}
.meta{text-align:center;color:#8a95ae;font-size:11px;border-left:1px solid #dde1ea;padding-left:8mm}
.meta b{display:block;color:#1a3a6b;font-size:13px;font-weight:800;margin-top:3px}
/* ─── Party strip ─── */
.party{display:grid;grid-template-columns:1fr 1fr;background:#f0f4fb;padding:6mm 14mm;gap:12mm;font-size:12px;line-height:1.55}
.party>div:last-child{text-align:right}
.party b{font-size:13px;color:#1a3a6b}
/* ─── Product table ─── */
.products{padding:6mm 14mm 2mm}
.products table{width:100%;border-collapse:collapse}
.products th{color:#586bc5;text-transform:uppercase;font-size:10px;border-bottom:2px solid #586bc5;padding:6px 5px;text-align:left}
.products td{padding:9px 5px;border-bottom:1px solid #dde1e6;font-size:12px}
.products th:nth-last-child(-n+3),.products td:nth-last-child(-n+3){text-align:right}
/* ─── Totals ─── */
.summary{display:flex;justify-content:flex-end;padding:3mm 14mm}
.total-box{width:96mm;background:#1a3a6b;color:#fff;padding:5mm;font-size:14px}
.total-line,.words-line{display:flex;justify-space-between;gap:12px}
.total-line{font-size:15px;font-weight:700}
.words-line{margin-top:6px;font-weight:700;font-size:11px}
.gst{text-align:right;margin-top:5px;font-size:10px;opacity:.85}
/* ─── Bottom sections ─── */
.bottom{display:grid;grid-template-columns:1fr 64mm;padding:4mm 14mm;gap:10mm;align-items:end}
.payment h2{color:#586bc5;font-size:13px;margin:0 0 4px}
.payment{font-size:12px;font-weight:700;line-height:1.6}
.vsig{text-align:center}
.vsig img{width:54mm;height:21mm;object-fit:contain;mix-blend-mode:multiply;filter:contrast(250%) brightness(140%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.vsig b{display:block;color:#1a3a6b;font-size:11px;margin-top:2px}
.status-bar{padding:0 14mm 4mm;display:flex;justify-content:space-between;color:#666;font-size:11px}
/* ─── Terms section (quotation page 2) ─── */
.terms{padding:6mm 14mm;font-size:12px;line-height:1.6}
.terms h2{font-size:13px;color:#1a3a6b;border-bottom:2px solid #586bc5;padding-bottom:3px;margin:10px 0 5px}
.terms p{margin:4px 0}
.sig-row{display:flex;justify-content:flex-end;padding:8mm 14mm 6mm;align-items:end}
.sig-block{text-align:center}
.sig-block img{display:block;width:54mm;height:21mm;object-fit:contain;margin:0 auto 4px;mix-blend-mode:multiply;filter:contrast(250%) brightness(140%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.sig-line{border-top:1px solid #333;padding-top:5px;font-size:11px}
/* ─── Agreement pages ─── */
.page{break-after:page;page-break-after:always}.page:last-of-type{break-after:auto;page-break-after:auto}
.agreement-body{padding:5mm 14mm;font-size:9.5px;line-height:1.32}
.agreement-body p{margin:2mm 0}
.agreement-body ol{padding-left:6mm;margin:2mm 0}
.agreement-body li{margin:1.5mm 0}
.agreement-body .clause{margin:2mm 0}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:10mm}
.sig-box{min-height:30mm}
.a-line{border-top:1px solid #333;padding-top:2mm;font-size:9px}
.disclaimer{font-size:8px;border-top:1px solid #aaa;padding-top:2mm;margin-top:5mm}
/* ─── Stamp ─── */
.stamp-wrap{text-align:center;margin:3mm 0 2mm}
.stamp{display:block;width:140mm;height:16mm;object-fit:contain;margin:0 auto;mix-blend-mode:multiply;filter:contrast(250%) brightness(140%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.annexure{text-align:right;font-weight:700;font-size:10px;margin-bottom:1mm}
.agr-title{text-align:center;font-size:11px;font-weight:700;margin:2mm 8mm}
/* ─── Misc ─── */
.page-break{break-before:page;page-break-before:always}
.actions{position:fixed;right:15px;bottom:15px;z-index:999}
@media print{body{background:#fff}.actions{display:none}.sheet{margin:0}}
`;

// ─── QUOTATION ────────────────────────────────────────────────────────────────
export function quotationDocument(row) {
  const customer = row.customers ?? {};
  const items = Array.isArray(row.quotation_items) ? row.quotation_items : (row.items || []);
  const primaryBrand = items[0]?.brand || items[0]?.products?.brand || items[0]?.brand_model || items[0]?.products?.model || "LivFast";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png`;

  const companyName = row.company_name || row.companyName || row.owner?.company_name || "A1 SOLAR SOLUTION";
  const companyAddress = row.company_address || row.companyAddress || row.owner?.company_address || "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR";
  const isSuperAdmin = row.ownerRole === "super_admin" || row.owner_role === "super_admin" || (!row.company_name && !row.companyName);
  const logoUrl = row.company_logo_url || row.companyLogoUrl || row.owner?.company_logo_url || (isSuperAdmin ? `${origin}/logo.png` : null);
  const signature = row.company_signature_url || row.companySignatureUrl || row.owner?.company_signature_url || `${origin}/document-assets/vendor-authorized-signature.png`;

  const itemRows = items.map((item, i) => {
    const product = item.products ?? {};
    const price = Number(item.unit_price ?? item.unitPrice ?? 0);
    const qty = parseQty(item.quantity);
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(product.name ?? item.product_name ?? item.productName ?? item.description)}</b></td>
      <td>${esc(item.description)}</td>
      <td>${esc(item.brand ?? product.brand ?? product.model ?? item.brand_model)}</td>
      <td style="text-align:right">${esc(item.quantity)}</td>
      <td style="text-align:right">${inr(price)}</td>
      <td style="text-align:right">${inr(qty * price)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;

  const grandTotal = Number(row.grand_total ?? row.grandTotal ?? row.total ?? 0);
  const bankAccHolder = row.bank_details?.accountHolder || row.bank_details?.account_holder || row.account_holder || row.payment_details?.account_holder || companyName;
  const bankName = row.bank_details?.bankName || row.bank_details?.bank_name || row.bank_name || row.payment_details?.bank_name || "PUNJAB NATIONAL BANK";
  const bankBranch = row.bank_details?.branch || row.bank_branch || row.payment_details?.branch || "TAJPUR";
  const bankAccNo = row.bank_details?.accountNo || row.bank_details?.account_no || row.account_no || row.payment_details?.account_no || "9335002100003167";
  const bankIfsc = row.bank_details?.ifscCode || row.bank_details?.ifsc_code || row.ifsc_code || row.payment_details?.ifsc_code || "PUNB0933500";

  const custName = customer.name || row.customer_name || row.customerName || "—";
  const custMobile = customer.mobile || row.customer_mobile || row.customerMobile || "—";
  const custEmail = customer.email || row.customer_email || row.customerEmail || "";
  const custGst = customer.gst_number || row.customer_gst || row.customerGst || "";
  const custAddress = row.installation_address || row.consumer_address || row.consumerAddress || customer.address || "—";

  const qNum = row.quotation_number || row.quotationNumber || row.number || "—";
  const qDate = row.quotation_date || row.quotationDate || "—";
  const qValid = row.valid_until || row.validUntil || "—";
  const qCap = row.capacity_kw || row.capacityKw || "—";
  const qType = row.quotation_type || row.quotationType || "Solar Power System";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${esc(qNum)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
    ${!isSuperAdmin ? `<div class="hero-patch"></div>` : ""}
  </div>
  <div class="doc-header cols-4">
    ${logoUrl ? `<img class="logo-brand" src="${esc(logoUrl)}" alt="Logo" onerror="this.style.display='none'">` : `<div style="width:44mm"></div>`}
    <div class="doc-title"><h1>QUOTATION</h1><b>${esc(qCap)} kW ${esc(qType)}</b></div>
    <div class="meta">Date<b>${esc(qDate)}</b></div>
    <div class="meta">Quotation #<b>${esc(qNum)}</b></div>
  </div>
  <section class="party">
    <div><b>${esc(companyName)}</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>${esc(companyAddress)}</div>
    <div><b>${esc(custName)}</b><br>Mobile: ${esc(custMobile)}${custEmail ? `<br>Email: ${esc(custEmail)}` : ""}${custGst ? `<br>GSTIN: ${esc(custGst)}` : ""}<br>${esc(custAddress)}</div>
  </section>
  <section class="products">
    <table>
      <thead><tr><th>#</th><th>Product Name</th><th>Description</th><th>Brand / Model</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </section>
  <section class="summary">
    <div class="total-box">
      <div class="total-line"><span>Grand Total :</span><span>${inr(grandTotal)}/-</span></div>
      <div class="words-line"><span>In Words :</span><span>${esc(amountWords(grandTotal))}</span></div>
      <div class="gst">${row.tax ? `(Subtotal: ${inr(row.subtotal)} | Tax: ${inr(row.tax)}) ` : ""}(Including GST)</div>
    </div>
  </section>
  <section class="bottom">
    <div class="payment">
      <h2>PAYMENT DETAILS</h2>
      ACCOUNT HOLDER: ${esc(bankAccHolder)}<br>
      ${esc(bankName)}<br>
      BRANCH: ${esc(bankBranch)}<br>
      A/C NO: ${esc(bankAccNo)}<br>
      IFSC CODE: ${esc(bankIfsc)}
    </div>
    <div class="vsig">
      <img src="${esc(signature)}" alt="Proprietor signature">
      <b>${esc(companyName)}<br>PROPRIETOR</b>
    </div>
  </section>

  <div class="page-break"></div>

  <div class="doc-header cols-4" style="margin-top:8mm">
    ${logoUrl ? `<img class="logo-brand" src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'">` : `<div style="width:44mm"></div>`}
    <div class="doc-title"><h1>QUOTATION</h1><b>Terms &amp; Conditions</b></div>
    <div class="meta">Valid Until<b>${esc(qValid)}</b></div>
    <div class="meta">Quotation #<b>${esc(qNum)}</b></div>
  </div>
  <div class="terms">
    <h2>Payment Terms</h2>
    <p>${esc(row.payment_terms ?? "Advance payment on order confirmation; balance after installation completion. Payment percentages are governed by the approved business template.")}</p>
    <h2>Delivery &amp; Installation</h2>
    <p>${esc(row.installation_terms ?? "Installation begins after advance payment and is subject to site readiness, approvals and material availability. Additional civil or electrical work is charged separately.")}</p>
    <h2>Guarantee &amp; Support</h2>
    <p>${esc(row.warranty_terms ?? "Solar panels, inverter and components carry their respective manufacturer warranties. Physical damage, misuse, theft, fire and natural calamities are excluded unless expressly covered.")}</p>
    <h2>System Components</h2>
    <p><b>Solar Panels:</b> High-efficiency modules selected for the approved capacity.</p>
    <p><b>Inverter:</b> Grid-compatible inverter sized for the system.</p>
    <p><b>Mounting Structure:</b> Site-specific structure designed for safe placement.</p>
    <p><b>Monitoring:</b> Performance monitoring subject to selected equipment.</p>
  </div>
  <div class="sig-row">
    <div class="sig-block">
      <img src="${esc(signature)}" alt="Proprietor signature">
      <div class="sig-line"><b>For ${esc(companyName)}</b><br>Authorized Signatory / Proprietor</div>
    </div>
  </div>
</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

// ─── INVOICE ─────────────────────────────────────────────────────────────────
export function invoiceDocument(row) {
  const customer = row.customers ?? {};
  const items = Array.isArray(row.invoice_items) ? row.invoice_items : (row.items || []);
  const primaryBrand = items[0]?.brand || items[0]?.products?.brand || items[0]?.brand_model || items[0]?.products?.model || "LivFast";
  const itemRows = items.map((item, i) => {
    const product = item.products ?? {};
    return `<tr>
      <td>${i + 1}.</td>
      <td><b>${esc(item.product_name ?? product.name)}</b></td>
      <td>${esc(item.description)}</td>
      <td>${esc(item.brand ?? product.brand ?? product.model)}</td>
      <td style="text-align:right">${esc(item.quantity)}</td>
      <td style="text-align:right">${inr(item.unit_price)}</td>
      <td style="text-align:right">${inr(item.line_amount ?? parseQty(item.quantity) * Number(item.unit_price || 0))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;

  const balance = Math.max(0, Number(row.total || 0) - Number(row.paid_amount || 0));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png`;

  const companyName = row.company_name || row.companyName || row.owner?.company_name || "A1 SOLAR SOLUTION";
  const companyAddress = row.company_address || row.companyAddress || row.owner?.company_address || "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR";
  const isSuperAdmin = row.ownerRole === "super_admin" || row.owner_role === "super_admin" || (!row.company_name && !row.companyName);
  const logoUrl = row.company_logo_url || row.companyLogoUrl || row.owner?.company_logo_url || (isSuperAdmin ? `${origin}/logo.png` : null);
  const signature = row.company_signature_url || row.companySignatureUrl || row.owner?.company_signature_url || `${origin}/document-assets/vendor-authorized-signature.png`;

  const bankAccHolder = row.bank_details?.accountHolder || row.bank_details?.account_holder || row.account_holder || row.payment_details?.account_holder || companyName;
  const bankName = row.bank_details?.bankName || row.bank_details?.bank_name || row.bank_name || row.payment_details?.bank_name || "PUNJAB NATIONAL BANK";
  const bankBranch = row.bank_details?.branch || row.bank_branch || row.payment_details?.branch || "TAJPUR";
  const bankAccNo = row.bank_details?.accountNo || row.bank_details?.account_no || row.account_no || row.payment_details?.account_no || "9335002100003167";
  const bankIfsc = row.bank_details?.ifscCode || row.bank_details?.ifsc_code || row.ifsc_code || row.payment_details?.ifsc_code || "PUNB0933500";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(row.invoice_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
    ${!isSuperAdmin ? `<div class="hero-patch"></div>` : ""}
  </div>
  <div class="doc-header cols-4">
    ${logoUrl ? `<img class="logo-brand" src="${esc(logoUrl)}" alt="Logo" onerror="this.style.display='none'">` : `<div style="width:44mm"></div>`}
    <div class="doc-title"><h1>INVOICE</h1><b>${esc(row.title ?? "SOLAR POWER SYSTEM")}</b></div>
    <div class="meta">Date<b>${esc(row.invoice_date)}</b></div>
    <div class="meta">Invoice #<b>${esc(row.invoice_number)}</b></div>
  </div>
  <section class="party">
    <div><b>${esc(companyName)}</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>${esc(companyAddress)}</div>
    <div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}${customer.email ? `<br>Email: ${esc(customer.email)}` : ""}${customer.gst_number ? `<br>GSTIN: ${esc(customer.gst_number)}` : ""}<br>${esc(row.installation_address)}</div>
  </section>
  <section class="products">
    <table>
      <thead><tr><th>#</th><th>Product Name</th><th>Description</th><th>Brand</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </section>
  <section class="summary">
    <div class="total-box">
      <div class="total-line"><span>Total :</span><span>${inr(row.total)}/-</span></div>
      <div class="words-line"><span>In Words :</span><span>${esc(amountWords(row.total))}</span></div>
      <div class="gst">(Including GST)</div>
    </div>
  </section>
  <section class="bottom">
    <div class="payment">
      <h2>PAYMENT DETAILS</h2>
      ACCOUNT HOLDER: ${esc(bankAccHolder)}<br>
      ${esc(bankName)}<br>
      BRANCH: ${esc(bankBranch)}<br>
      A/C NO: ${esc(bankAccNo)}<br>
      IFSC CODE: ${esc(bankIfsc)}
    </div>
    <div class="vsig">
      <img src="${esc(signature)}" alt="Proprietor signature">
      <b>${esc(companyName)}<br>PROPRIETOR</b>
    </div>
  </section>
  <section class="status-bar">
    <span>Paid: ${inr(row.paid_amount)} &nbsp;|&nbsp; Balance: ${inr(balance)}</span>
    <span>Status: ${esc(row.status)} &nbsp;|&nbsp; Due: ${esc(row.due_date)}</span>
  </section>
</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

// ─── AGREEMENT ───────────────────────────────────────────────────────────────
export function agreementDocument(row) {
  const customer = row.customers ?? {};
  const merged = row.merged_data ?? {};
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const stamp = `${origin}/document-assets/agreement-stamp-paper.png`;

  const companyName = row.company_name || row.companyName || row.owner?.company_name || "A1 SOLAR SOLUTIONS";
  const companyAddress = row.company_address || row.companyAddress || row.owner?.company_address || "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR";
  const vendorSign = row.company_signature_url || row.companySignatureUrl || row.owner?.company_signature_url || `${origin}/document-assets/vendor-authorized-signature.png`;

  const rawDate = String(merged.agreement_date || row.agreement_date || row.created_at || new Date().toISOString());
  const parsedDate = new Date(rawDate);
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const dayStr = !Number.isNaN(parsedDate.getTime()) ? String(parsedDate.getDate()) : "25";
  const monthStr = !Number.isNaN(parsedDate.getTime()) ? monthNames[parsedDate.getMonth()] : "APRIL";
  const yearStr = !Number.isNaN(parsedDate.getTime()) ? String(parsedDate.getFullYear()) : "2026";
  const formattedExecDate = `<b>${dayStr}</b> (Day) - <b>${monthStr}</b> (Month) - <b>${yearStr}</b> (Year)`;
  const displayDate = !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "25 Apr 2026";

  const custName = customer.name || row.customer_name || row.customerName || merged.consumer_name || "ARJUN CHAUDHARY";
  const custAddress = merged.consumer_address || row.installation_address || customer.address || "NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503";

  const customerSigHtml = row.customer_signature_url
    ? `<img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(String(row.customer_signature_url))}" alt="Customer signature">`
    : ``;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Agreement ${esc(row.agreement_number)}</title>
<style>
${sharedCss()}
.agr-box-grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:5mm}
.agr-sig-card{border:1px solid #333;padding:4mm;font-size:10.5px;min-height:48mm;display:flex;flex-direction:column;justify-content:space-between}
</style></head><body>
<main class="sheet">

<!-- PAGE 1 -->
<div class="page">
  <div class="agreement-body" style="padding:10mm 14mm;font-size:10.5px;line-height:1.4">
    <div style="text-align:center;margin-bottom:4mm">
      <img class="stamp" src="${esc(stamp)}" alt="Revenue stamp" style="max-height:22mm;object-fit:contain;margin:0 auto" onerror="this.style.display='none'">
    </div>
    
    <div style="text-align:center;font-weight:700;font-size:12px;margin:2mm 0">Annexure 2</div>
    <p style="text-align:center;font-size:12px;font-weight:700;line-height:1.4;margin:2mm 0">
      Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project<br>
      under PM – Surya Ghar: Muft Bijali Yojana
    </p>
    
    <p style="margin:4mm 0">This agreement is executed on ${formattedExecDate} for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana</p>
    
    <p style="text-align:center;margin:3mm 0"><b>Between</b></p>
    
    <p style="margin:2mm 0"><b>${esc(custName)}</b> (Name of Consumer) having<br><b>${esc(custAddress)}</b> (herein referred to as first Party i.e. Consumer / purchaser / owner of system).</p>
    
    <p style="text-align:center;margin:3mm 0"><b>And</b></p>
    
    <p style="margin:2mm 0"><b>${esc(companyName)}</b> (Name of Vendor) having registered office at <b>${esc(companyAddress)}</b> (hereinafter referred to as second Party i.e. Vendor / contractor / System Integrator).</p>
    
    <p style="margin:3mm 0"><b>Whereas</b><br>First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.</p>
    
    <p style="margin:3mm 0"><b>And whereas</b><br>Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period.</p>
    
    <p style="margin:3mm 0">On this day, the First Party and Second Party agree to the following:</p>
    
    <p style="margin:2mm 0"><b>The First Party hereby undertakes to perform the following activities:</b></p>
    <ul style="padding-left:18px;margin:2mm 0;list-style-type:disc">
      <li style="margin:1.5mm 0">Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme</li>
      <li style="margin:1.5mm 0">Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system</li>
      <li style="margin:1.5mm 0">Provide access to the Roof Top during installation of the plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li>
      <li style="margin:1.5mm 0">Provide electricity during plant installation and water for cleaning of the panels</li>
      <li style="margin:1.5mm 0">Report any malfunctioning of the plant to the Vendor during the warranty period</li>
      <li style="margin:1.5mm 0">Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work / customization required depending upon the building condition</li>
    </ul>
    
    <p style="margin:2mm 0"><b>The Second Party hereby undertakes to perform the following activities:</b></p>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="agreement-body" style="padding:10mm 14mm;font-size:10.5px;line-height:1.4">
    <p style="margin-bottom:4mm">The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Site Survey:</b> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Design &amp; Engineering:</b> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Module and Inverter:</b> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Procurement &amp; Supply:</b> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Installation &amp; Civil work:</b> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Documentation (Technical Catalogues/Warranty Certificates/BIS certificates/other test reports etc):</b> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Project completion report (PCR):</b> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Warranty:</b> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>NET meter &amp; Grid Connectivity:</b> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Testing and Commissioning:</b> The vendor shall be present at the time of testing and commissioning by the DISCOM.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Operation &amp; Maintenance:</b> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</p>

    <p class="clause" style="margin:2.5mm 0"><b>Insurance:</b> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</p>

    <p class="clause" style="margin:2.5mm 0"><b>Applicable Standard:</b> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</p>

    <p class="clause" style="margin:2.5mm 0"><b>Project/system cost &amp; payment terms:</b> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
  </div>
</div>

<!-- PAGE 3 -->
<div class="page">
  <div class="agreement-body" style="padding:10mm 14mm;font-size:10.5px;line-height:1.4">
    <p class="clause" style="margin:2.5mm 0"><b>Dispute:</b> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to such private dispute.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Subsidy / Project Related Documents:</b> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</p>
    
    <p class="clause" style="margin:2.5mm 0"><b>Performance of Plant:</b> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorised agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning/testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</p>
    
    <p class="clause" style="margin:3mm 0"><b>19. Mutually Agreed Terms of Payment:</b><br>The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
    
    <div class="agr-box-grid">
      <div class="agr-sig-card">
        <div>
          <b>First Party (Consumer)</b><br>
          Name: <b>${esc(custName)}</b><br>
          Address: <b>${esc(custAddress)}</b><br>
          Signature:
          ${customerSigHtml}
        </div>
        <div style="margin-top:6mm">Date: <b>${esc(displayDate)}</b></div>
      </div>

      <div class="agr-sig-card">
        <div>
          <b>Second Party (Vendor)</b><br>
          Name: <b>${esc(companyName)}</b><br>
          Address: <b>${esc(companyAddress)}</b><br>
          Signature:<br>
          <img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(vendorSign)}" alt="Vendor signature" onerror="this.style.display='none'">
        </div>
        <div style="margin-top:2mm">Date: <b>${esc(displayDate)}</b></div>
      </div>
    </div>
    
    <p style="margin-top:10mm;font-size:9px;font-style:italic">Disclaimer: This agreement is between vendor and consumer and any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p>
  </div>
</div>

</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}
