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

export const amountWords = (value) => {
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
html,body{margin:0;font:12px Arial,Helvetica,sans-serif;color:#333;background:#e8e8e8;color-scheme:light}
.sheet{width:210mm;min-height:297mm;margin:auto;background:#fff;color:#333}
/* ─── Hero Banner ─── */
.hero-container{position:relative;width:100%;height:68mm;overflow:hidden}
.hero{width:100%;height:100%;display:block;object-fit:cover;object-position:50% 40%;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.hero-text{position:absolute;top:12%;left:50%;transform:translateX(-50%);color:#ff0000;font-size:42px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;letter-spacing:-0.5px;z-index:2}
/* ─── Sub-header row ─── */
.doc-header{display:grid;align-items:center;padding:4mm 14mm;border-bottom:1px solid #dde1ea;gap:0}
.doc-header.cols-4{grid-template-columns:44mm 1fr 34mm 36mm}
.doc-header.cols-3{grid-template-columns:44mm 1fr 60mm}
.logo-brand{display:block;height:18mm;width:auto;max-width:42mm;object-fit:contain;background:transparent;border-radius:50%;mix-blend-mode:multiply;filter:contrast(100%) brightness(100%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
/* ─── Agreement logo header ─── */
.agr-logo-header{display:flex;align-items:center;justify-content:flex-start;padding:4mm 14mm 2mm;border-bottom:1px solid #dde1ea;margin-bottom:3mm}
.agr-logo-header img{height:16mm;width:auto;object-fit:contain;background:transparent;border-radius:50%;mix-blend-mode:multiply;filter:contrast(100%) brightness(100%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
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
.vsig img{width:54mm;height:21mm;object-fit:contain;mix-blend-mode:multiply;filter:contrast(100%) brightness(100%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.vsig b{display:block;color:#1a3a6b;font-size:11px;margin-top:2px}
.status-bar{padding:0 14mm 4mm;display:flex;justify-content:space-between;color:#666;font-size:11px}
/* ─── Terms section (quotation page 2) ─── */
.terms{padding:6mm 14mm;font-size:12px;line-height:1.6}
.terms h2{font-size:13px;color:#1a3a6b;border-bottom:2px solid #586bc5;padding-bottom:3px;margin:10px 0 5px}
.terms p{margin:4px 0}
.sig-row{display:flex;justify-content:flex-end;padding:8mm 14mm 6mm;align-items:end}
.sig-block{text-align:center}
.sig-block img{display:block;width:54mm;height:21mm;object-fit:contain;margin:0 auto 4px;mix-blend-mode:multiply;filter:contrast(100%) brightness(100%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
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
.stamp{display:block;width:140mm;height:16mm;object-fit:contain;margin:0 auto;mix-blend-mode:multiply;filter:contrast(100%) brightness(100%);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.annexure{text-align:right;font-weight:700;font-size:10px;margin-bottom:1mm}
.agr-title{text-align:center;font-size:11px;font-weight:700;margin:2mm 8mm}
/* ─── Misc ─── */
.page-break{break-before:page;page-break-before:always}
.actions{position:fixed;right:15px;bottom:15px;z-index:999}
@media print{
  html,body{background:#fff !important;color:#000 !important;color-scheme:light !important}
  *{mix-blend-mode:normal !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .actions{display:none !important}
  .sheet{margin:0 !important;box-shadow:none !important;background:#fff !important}
}
`;

// ─── QUOTATION ────────────────────────────────────────────────────────────────
export function quotationDocument(row) {
  const customer = row.customers ?? {};
  const items = Array.isArray(row.quotation_items) ? row.quotation_items : (row.items || []);
  const primaryBrand = items[0]?.brand || items[0]?.products?.brand || items[0]?.brand_model || items[0]?.products?.model || "LivFast";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png?v=clean2`;

  const companyName = row.company_name || row.companyName || row.owner?.company_name || "A1 SOLAR SOLUTION";
  const companyAddress = row.company_address || row.companyAddress || row.owner?.company_address || "";
  const companyGstin = row.company_gstin || row.companyGstin || row.owner?.company_gstin || "";
  const companyPhone = row.company_phone || row.companyPhone || row.owner?.phone || row.owner?.mobile || "";
  const companyEmail = row.company_email || row.companyEmail || row.owner?.email || "";
  const isSuperAdmin = row.ownerRole === "super_admin" || row.owner_role === "super_admin" || (!row.company_name && !row.companyName && !row.owner?.company_name);
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
  const bankName = row.bank_details?.bankName || row.bank_details?.bank_name || row.bank_name || row.payment_details?.bank_name || "";
  const bankBranch = row.bank_details?.branch || row.bank_branch || row.payment_details?.branch || "";
  const bankAccNo = row.bank_details?.accountNo || row.bank_details?.account_no || row.account_no || row.payment_details?.account_no || "";
  const bankIfsc = row.bank_details?.ifscCode || row.bank_details?.ifsc_code || row.ifsc_code || row.payment_details?.ifsc_code || "";

  const custName = customer.name || row.customer_name || row.customerName || "—";
  const custMobile = customer.mobile || row.customer_mobile || row.customerMobile || "—";
  const custEmail = customer.email || row.customer_email || row.customerEmail || "";
  const custAddress = row.installation_address || row.consumer_address || row.consumerAddress || customer.address || "—";

  const qNum = row.quotation_number || row.quotationNumber || row.number || "—";
  const qDate = row.quotation_date || row.quotationDate || "—";
  const qCap = row.capacity_kw || row.capacityKw || "—";
  const qType = row.quotation_type || row.quotationType || "Solar Power System";
  const rawCap = row.capacity_kw || row.capacityKw || "3";
  const capStr = String(rawCap).toUpperCase().includes("KW") ? String(rawCap) : `${rawCap}KW`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${esc(qNum)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
  </div>
  <div class="doc-header cols-4">
    ${logoUrl ? `<img class="logo-brand" src="${esc(logoUrl)}" alt="Logo" onerror="this.style.display='none'">` : `<div style="width:44mm"></div>`}
    <div class="doc-title"><h1>QUOTATION</h1><b>${esc(qCap)} kW ${esc(qType)}</b></div>
    <div class="meta">Date<b>${esc(qDate)}</b></div>
    <div class="meta">Quotation #<b>${esc(qNum)}</b></div>
  </div>
  <section class="party">
    <div>
      <b>${esc(companyName)}</b><br>
      ${companyPhone ? `Mobile: ${esc(companyPhone)}<br>` : ""}
      ${companyEmail ? `Email: ${esc(companyEmail)}<br>` : ""}
      ${companyGstin ? `GSTIN: ${esc(companyGstin)}<br>` : ""}
      ${esc(companyAddress)}
    </div>
    <div><b>${esc(custName)}</b><br>Mobile: ${esc(custMobile)}${custEmail ? `<br>Email: ${esc(custEmail)}` : ""}<br>${esc(custAddress)}</div>
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
    <div class="meta">Date<b>${esc(qDate)}</b></div>
    <div class="meta">Quotation #<b>${esc(qNum)}</b></div>
  </div>
  <div class="terms">
    <h2>Payment Terms</h2>
    <p>70% advance payment shall be made at the time of order confirmation. Remaining 30% payment shall be made immediately after installation completion. All payments must be made through Bank Transfer / UPI / Cheque only. Any delay in payment may result in project delay or suspension of service.</p>
    <h2>Delivery &amp; Installation</h2>
    <p>Delivery and installation process will begin only after receiving the advance payment. Installation timeline: 7–15 working days depending on site condition and material availability. Customer must ensure proper site access, safety, and necessary approvals at the installation location. Any additional civil or electrical work required at the site will be chargeable. Civil Work is to be done by the customer at their own cost.</p>
    <h2>Guarantee &amp; Support</h2>
    <p>Solar Panels: Up to 30 years performance guarantee as per manufacturer policy. Inverter &amp; Other Components: Standard manufacturer guarantee shall apply. 1-year free service support shall be provided from the date of installation. Guarantee shall not cover physical damage, mishandling, fire, theft, or natural calamities.</p>
    <h2>System Components</h2>
    <p style="margin-top:6px"><b style="color:#1a3a6b">Solar Panels</b><br>We propose using high-efficiency solar panels from renowned brands, such as ${esc(primaryBrand)} with a total capacity of ${esc(capStr)}</p>
    <p style="margin-top:6px"><b style="color:#1a3a6b">Inverter</b><br>We recommend reliable and industry-standard ON grid inverters from brands like ${esc(primaryBrand)} based on the system's size and requirements.</p>
    <p style="margin-top:6px"><b style="color:#1a3a6b">Mounting Structure</b><br>Customized GI mounting structures will be designed and installed to optimize the placement and efficiency of the solar panels</p>
    <p style="margin-top:6px"><b style="color:#1a3a6b">Monitoring System</b><br>A real-time monitoring system will be implemented to track the system's performance and ensure optimal operation.</p>
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
  
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let grandTotal = 0;
  let hasIgst = items.some(it => Number(it.igst_rate ?? it.igstRate ?? 0) > 0);

  const itemRows = items.map((item, i) => {
    const product = item.products ?? {};
    const pName = item.product_name ?? item.productName ?? product.name ?? "Solar Product";
    const desc = item.description ?? "";
    const brand = item.brand ?? product.brand ?? product.model ?? "LivFast";
    const qtyStr = String(item.quantity ?? "1");
    const qtyNum = parseQty(qtyStr) || 1;
    const priceIncl = Number(item.unit_price ?? item.unitPrice ?? 0);
    const lineTotal = item.line_amount ?? (qtyNum * priceIncl);

    const cgstR = Number(item.cgst_rate ?? item.cgstRate ?? 2.5);
    const sgstR = Number(item.sgst_rate ?? item.sgstRate ?? 2.5);
    const igstR = Number(item.igst_rate ?? item.igstRate ?? 0);

    const totalGstR = cgstR + sgstR + igstR;
    const taxableAmt = totalGstR > 0 ? lineTotal / (1 + totalGstR / 100) : lineTotal;
    const cgstAmt = taxableAmt * (cgstR / 100);
    const sgstAmt = taxableAmt * (sgstR / 100);
    const igstAmt = taxableAmt * (igstR / 100);

    totalTaxable += taxableAmt;
    totalCgst += cgstAmt;
    totalSgst += sgstAmt;
    totalIgst += igstAmt;
    grandTotal += lineTotal;

    return `<tr>
      <td style="text-align:center">${i + 1}.</td>
      <td>
        <b>${esc(pName)}</b>
        ${desc ? `<br><span style="font-size:11px;color:#333">${esc(desc)}</span>` : ""}
        ${brand ? `<br><span style="font-size:10px;color:#666">Brand: ${esc(brand)}</span>` : ""}
      </td>
      <td style="text-align:center">${esc(qtyStr)}</td>
      <td style="text-align:right">Rs ${inr(priceIncl)}</td>
      <td style="text-align:right">Rs ${taxableAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="text-align:right">
        Rs ${cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
        <small style="color:#666">(${cgstR.toFixed(2)}%)</small>
      </td>
      <td style="text-align:right">
        Rs ${sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
        <small style="color:#666">(${sgstR.toFixed(2)}%)</small>
      </td>
      ${hasIgst ? `
        <td style="text-align:right">
          Rs ${igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
          <small style="color:#666">(${igstR.toFixed(2)}%)</small>
        </td>
      ` : ""}
      <td style="text-align:right"><b>Rs ${inr(lineTotal)}</b></td>
    </tr>`;
  }).join("") || `<tr><td colspan="${hasIgst ? 9 : 8}">No line items recorded</td></tr>`;

  const balance = Math.max(0, Number(row.total || grandTotal || 0) - Number(row.paid_amount || 0));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const header = `${origin}/document-assets/solar-document-header.png?v=clean2`;

  const companyName = row.company_name || row.companyName || row.owner?.company_name || "A1 SOLAR SOLUTION";
  const companyAddress = row.company_address || row.companyAddress || row.owner?.company_address || "";
  const companyGstin = row.company_gstin || row.companyGstin || row.owner?.company_gstin || "";
  const companyPhone = row.company_phone || row.companyPhone || row.owner?.phone || row.owner?.mobile || "";
  const companyEmail = row.company_email || row.companyEmail || row.owner?.email || "";
  const isSuperAdmin = row.ownerRole === "super_admin" || row.owner_role === "super_admin" || (!row.company_name && !row.companyName && !row.owner?.company_name);
  const logoUrl = row.company_logo_url || row.companyLogoUrl || row.owner?.company_logo_url || (isSuperAdmin ? `${origin}/logo.png` : null);
  const signature = row.company_signature_url || row.companySignatureUrl || row.owner?.company_signature_url || `${origin}/document-assets/vendor-authorized-signature.png`;

  const bankAccHolder = row.bank_details?.accountHolder || row.bank_details?.account_holder || row.account_holder || row.payment_details?.account_holder || companyName;
  const bankName = row.bank_details?.bankName || row.bank_details?.bank_name || row.bank_name || row.payment_details?.bank_name || "";
  const bankBranch = row.bank_details?.branch || row.bank_branch || row.payment_details?.branch || "";
  const bankAccNo = row.bank_details?.accountNo || row.bank_details?.account_no || row.account_no || row.payment_details?.account_no || "";
  const bankIfsc = row.bank_details?.ifscCode || row.bank_details?.ifsc_code || row.ifsc_code || row.payment_details?.ifsc_code || "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(row.invoice_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
  </div>
  <div class="doc-header cols-4">
    ${logoUrl ? `<img class="logo-brand" src="${esc(logoUrl)}" alt="Logo" onerror="this.style.display='none'">` : `<div style="width:44mm"></div>`}
    <div class="doc-title"><h1>INVOICE</h1><b>${esc(row.title ?? "SOLAR POWER SYSTEM")}</b></div>
    <div class="meta">Date<b>${esc(row.invoice_date)}</b></div>
    <div class="meta">Invoice #<b>${esc(row.invoice_number)}</b></div>
  </div>
  <section class="party">
    <div>
      <b>${esc(companyName)}</b><br>
      ${companyPhone ? `Mobile: ${esc(companyPhone)}<br>` : ""}
      ${companyEmail ? `Email: ${esc(companyEmail)}<br>` : ""}
      ${companyGstin ? `GSTIN: ${esc(companyGstin)}<br>` : ""}
      ${esc(companyAddress)}
    </div>
    <div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}${customer.email ? `<br>Email: ${esc(customer.email)}` : ""}<br>${esc(row.installation_address)}</div>
  </section>
  <section class="products">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item Details</th>
          <th>QTY</th>
          <th>Price (Incl.)</th>
          <th>Taxable Amt</th>
          <th>CGST</th>
          <th>SGST</th>
          ${hasIgst ? `<th>IGST</th>` : ""}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </section>
  <section class="summary" style="margin-top:14px; display:flex; justify-content:flex-end;">
    <div style="width: 320px; font-size: 12px; font-family: sans-serif;">
      <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">
        <span>Taxable Amount:</span>
        <b style="color:#1e293b">Rs ${totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
      </div>
      <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">
        <span>CGST:</span>
        <b style="color:#1e293b">Rs ${totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
      </div>
      <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">
        <span>SGST:</span>
        <b style="color:#1e293b">Rs ${totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
      </div>
      ${hasIgst || totalIgst > 0 ? `
        <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">
          <span>IGST:</span>
          <b style="color:#1e293b">Rs ${totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        </div>
      ` : ""}
      <div style="background:#5569c7; color:#fff; padding:10px 14px; margin-top:6px; border-radius:4px; text-align:right;">
        <div style="font-size:15px; font-weight:700;">Total: Rs ${inr(grandTotal)}/-</div>
        <div style="font-size:12px; margin-top:2px; font-weight:600;">In Words: ${esc(amountWords(grandTotal))}</div>
        <div style="font-size:11px; opacity:0.9;">(Inclusive of GST)</div>
      </div>
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

  const custName = row.customer_name || row.customerName || customer.name || merged.consumer_name || "ARJUN CHAUDHARY";
  const custAddress =
    row.consumer_address ||
    row.consumerAddress ||
    row.installation_address ||
    (customer.address && customer.address !== "NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503" ? customer.address : null) ||
    (merged.consumer_address && merged.consumer_address !== "NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503" ? merged.consumer_address : null) ||
    "NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503";

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
    <div style="text-align:center;margin-bottom:3mm">
      <img class="stamp" src="${esc(stamp)}" alt="Revenue stamp" style="max-height:20mm;object-fit:contain;margin:0 auto" onerror="this.style.display='none'">
    </div>
    
    <div style="text-align:center;font-weight:700;font-size:12px;margin:1.5mm 0">Annexure 2</div>
    <p style="text-align:center;font-size:11.5px;font-weight:700;line-height:1.35;margin:1.5mm 0">
      Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project<br>
      under PM – Surya Ghar: Muft Bijali Yojana
    </p>
    
    <p style="margin:2.5mm 0">This agreement is executed on ${formattedExecDate} for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana</p>
    
    <p style="text-align:center;margin:2mm 0"><b>Between</b></p>
    
    <p style="margin:1.5mm 0"><b>${esc(custName)}</b> (Name of Consumer) having<br><b>${esc(custAddress)}</b> (herein referred to as first Party i.e. Consumer / purchaser / owner of system).</p>
    
    <p style="text-align:center;margin:2mm 0"><b>And</b></p>
    
    <p style="margin:1.5mm 0"><b>${esc(companyName)}</b> (Name of Vendor) having registered office at <b>${esc(companyAddress)}</b> (hereinafter referred to as second Party i.e. Vendor / contractor / System Integrator).</p>
    
    <p style="margin:2mm 0"><b>Whereas</b><br>First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.</p>
    
    <p style="margin:2mm 0"><b>And whereas</b><br>Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period.</p>
    
    <p style="margin:2mm 0">On this day, the First Party and Second Party agree to the following:</p>
    
    <p style="margin:1.5mm 0"><b>The First Party hereby undertakes to perform the following activities:</b></p>
    <ul style="padding-left:18px;margin:1.5mm 0;list-style-type:disc">
      <li style="margin:1mm 0">Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme</li>
      <li style="margin:1mm 0">Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system</li>
      <li style="margin:1mm 0">Provide access to the Roof Top during installation of the plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li>
      <li style="margin:1mm 0">Provide electricity during plant installation and water for cleaning of the panels</li>
      <li style="margin:1mm 0">Report any malfunctioning of the plant to the Vendor during the warranty period</li>
      <li style="margin:1mm 0">Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work / customization required depending upon the building condition</li>
    </ul>
    
    <p style="margin:2mm 0"><b>The Second Party hereby undertakes to perform the following activities:</b></p>
    <p style="margin-bottom:2mm">The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Site Survey:</b> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Design &amp; Engineering:</b> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</p>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="agreement-body" style="padding:10mm 14mm;font-size:10px;line-height:1.35">
    <p class="clause" style="margin:1.5mm 0"><b>Module and Inverter:</b> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Procurement &amp; Supply:</b> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Installation &amp; Civil work:</b> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Documentation (Technical Catalogues/Warranty Certificates/BIS certificates/other test reports etc):</b> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Project completion report (PCR):</b> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Warranty:</b> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>NET meter &amp; Grid Connectivity:</b> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Testing and Commissioning:</b> The vendor shall be present at the time of testing and commissioning by the DISCOM.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Operation &amp; Maintenance:</b> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</p>

    <p class="clause" style="margin:1.5mm 0"><b>Insurance:</b> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</p>

    <p class="clause" style="margin:1.5mm 0"><b>Applicable Standard:</b> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</p>

    <p class="clause" style="margin:1.5mm 0"><b>Project/system cost &amp; payment terms:</b> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>

    <p class="clause" style="margin:1.5mm 0"><b>Dispute:</b> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to such private dispute.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Subsidy / Project Related Documents:</b> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</p>
    
    <p class="clause" style="margin:1.5mm 0"><b>Performance of Plant:</b> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorised agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning/testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</p>
    
    <p class="clause" style="margin:2mm 0"><b>19. Mutually Agreed Terms of Payment:</b><br>The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
    
    <div class="agr-box-grid" style="margin-top:3mm">
      <div class="agr-sig-card" style="padding:3mm;min-height:42mm">
        <div>
          <b>First Party (Consumer)</b><br>
          Name: <b>${esc(custName)}</b><br>
          Address: <b>${esc(custAddress)}</b><br>
          Signature:
          ${customerSigHtml}
        </div>
        <div style="margin-top:4mm">Date: <b>${esc(displayDate)}</b></div>
      </div>

      <div class="agr-sig-card" style="padding:3mm;min-height:42mm">
        <div>
          <b>Second Party (Vendor)</b><br>
          Name: <b>${esc(companyName)}</b><br>
          Address: <b>${esc(companyAddress)}</b><br>
          Signature:<br>
          <img style="height:16mm;max-width:50mm;object-fit:contain;display:block;margin:1.5mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(vendorSign)}" alt="Vendor signature" onerror="this.style.display='none'">
        </div>
        <div style="margin-top:2mm">Date: <b>${esc(displayDate)}</b></div>
      </div>
    </div>
    
    <p style="margin-top:4mm;font-size:8.5px;font-style:italic">Disclaimer: This agreement is between vendor and consumer and any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p>
  </div>
</div>

</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}
