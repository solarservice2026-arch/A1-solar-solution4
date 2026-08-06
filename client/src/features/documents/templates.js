import logo from "../../assets/a1-solar-logo-transparent.png";

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
/* ─── Sub-header row ─── */
.doc-header{display:grid;align-items:center;padding:4mm 14mm;border-bottom:1px solid #dde1ea;gap:0}
.doc-header.cols-4{grid-template-columns:44mm 1fr 34mm 36mm}
.doc-header.cols-3{grid-template-columns:44mm 1fr 60mm}
.mini-brand{font-weight:900;color:#163d52;font-size:13px;line-height:1.3;text-transform:uppercase}
.logo-brand{display:block;height:18mm;width:auto;max-width:42mm;object-fit:contain;background:transparent;print-color-adjust:exact;-webkit-print-color-adjust:exact}
/* ─── Agreement logo header ─── */
.agr-logo-header{display:flex;align-items:center;justify-content:flex-start;padding:4mm 14mm 2mm;border-bottom:1px solid #dde1ea;margin-bottom:3mm}
.agr-logo-header img{height:16mm;width:auto;object-fit:contain;background:transparent;print-color-adjust:exact;-webkit-print-color-adjust:exact}
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
.vsig img{width:54mm;height:21mm;object-fit:contain;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.vsig b{display:block;color:#1a3a6b;font-size:11px;margin-top:2px}
.status-bar{padding:0 14mm 4mm;display:flex;justify-content:space-between;color:#666;font-size:11px}
/* ─── Terms section (quotation page 2) ─── */
.terms{padding:6mm 14mm;font-size:12px;line-height:1.6}
.terms h2{font-size:13px;color:#1a3a6b;border-bottom:2px solid #586bc5;padding-bottom:3px;margin:10px 0 5px}
.terms p{margin:4px 0}
.sig-row{display:flex;justify-content:flex-end;padding:8mm 14mm 6mm;align-items:end}
.sig-block{text-align:center}
.sig-block img{display:block;width:54mm;height:21mm;object-fit:contain;margin:0 auto 4px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
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
.stamp{display:block;width:140mm;height:16mm;object-fit:contain;margin:0 auto;print-color-adjust:exact;-webkit-print-color-adjust:exact}
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
  const signature = `${origin}/document-assets/vendor-authorized-signature.png`;
  const logoUrl = `${origin}${logo}`;

  const itemRows = items.map((item, i) => {
    const product = item.products ?? {};
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(product.name ?? item.product_name ?? item.description)}</b></td>
      <td>${esc(item.description)}</td>
      <td>${esc(item.brand ?? product.brand ?? product.model ?? item.brand_model)}</td>
      <td style="text-align:right">${esc(item.quantity)}</td>
      <td style="text-align:right">${inr(item.unit_price)}</td>
      <td style="text-align:right">${inr(parseQty(item.quantity) * Number(item.unit_price || 0))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No line items recorded</td></tr>`;

  const bankAccHolder = row.account_holder || row.payment_details?.account_holder || "A1 SOLAR SOLUTION";
  const bankName = row.bank_name || row.payment_details?.bank_name || "PUNJAB NATIONAL BANK";
  const bankBranch = row.bank_branch || row.payment_details?.branch || "TAJPUR";
  const bankAccNo = row.account_no || row.payment_details?.account_no || "9335002100003167";
  const bankIfsc = row.ifsc_code || row.payment_details?.ifsc_code || "PUNB0933500";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${esc(row.quotation_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="A1 Solar Solution Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
  </div>
  <div class="doc-header cols-4">
    <img class="logo-brand" src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'">
    <div class="doc-title"><h1>QUOTATION</h1><b>${esc(row.capacity_kw)} kW ${esc(row.quotation_type ?? "Solar Power System")}</b></div>
    <div class="meta">Date<b>${esc(row.quotation_date)}</b></div>
    <div class="meta">Quotation #<b>${esc(row.quotation_number)}</b></div>
  </div>
  <section class="party">
    <div><b>A1 SOLAR SOLUTION</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</div>
    <div><b>${esc(customer.name)}</b><br>Mobile: ${esc(customer.mobile)}${customer.email ? `<br>Email: ${esc(customer.email)}` : ""}${customer.gst_number ? `<br>GSTIN: ${esc(customer.gst_number)}` : ""}<br>${esc(row.installation_address)}</div>
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
      <b>A1 SOLAR SOLUTION<br>PROPRIETOR</b>
    </div>
  </section>

  <div class="page-break"></div>

  <div class="doc-header cols-4" style="margin-top:8mm">
    <img class="logo-brand" src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'">
    <div class="doc-title"><h1>QUOTATION</h1><b>Terms &amp; Conditions</b></div>
    <div class="meta">Valid Until<b>${esc(row.valid_until)}</b></div>
    <div class="meta">Quotation #<b>${esc(row.quotation_number)}</b></div>
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
      <img src="${esc(signature)}" alt="A1 Solar proprietor signature">
      <div class="sig-line"><b>For A1 Solar Solution</b><br>Authorized Signatory / Proprietor</div>
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
  const signature = `${origin}/document-assets/vendor-authorized-signature.png`;
  const logoUrl = `${origin}${logo}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(row.invoice_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">
  <div class="hero-container">
    <img class="hero" src="${esc(header)}" alt="A1 Solar Solution Header Banner">
    <div class="hero-text">${esc(primaryBrand)}</div>
  </div>
  <div class="doc-header cols-4">
    <img class="logo-brand" src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'">
    <div class="doc-title"><h1>INVOICE</h1><b>${esc(row.title ?? "SOLAR POWER SYSTEM")}</b></div>
    <div class="meta">Date<b>${esc(row.invoice_date)}</b></div>
    <div class="meta">Invoice #<b>${esc(row.invoice_number)}</b></div>
  </div>
  <section class="party">
    <div><b>A1 SOLAR SOLUTION</b><br>Mobile: 7739661147<br>Email: a1solarsolution2026@gmail.com<br>GSTIN: 10EFTPA0258C1Z1<br>VISHNUPUR KAIJU PATEHPUR VAISHALI BIHA</div>
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
      ACCOUNT HOLDER: A1 SOLAR SOLUTION<br>
      PUNJAB NATIONAL BANK<br>
      BRANCH: TAJPUR<br>
      A/C NO: 9335002100003167<br>
      IFSC CODE: PUNB0933500
    </div>
    <div class="vsig">
      <img src="${esc(signature)}" alt="Proprietor signature">
      <b>A1 SOLAR SOLUTION<br>PROPRIETOR</b>
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
  const vendorSign = `${origin}/document-assets/vendor-authorized-signature.png`;
  const logoUrl = `${origin}${logo}`;

  const rawDate = String(merged.agreement_date ?? row.created_at ?? new Date().toISOString());
  const parsedDate = new Date(rawDate);
  const address = esc(merged.consumer_address || customer.address || "N/A");
  const displayDate = Number.isNaN(parsedDate.getTime())
    ? esc(rawDate.slice(0, 10))
    : parsedDate.toLocaleDateString("en-CA");

  const customerSigHtml = row.customer_signature_url
    ? `<img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(String(row.customer_signature_url))}" alt="Customer signature">`
    : ``;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Agreement ${esc(row.agreement_number)}</title>
<style>${sharedCss()}</style></head><body>
<main class="sheet">

<!-- PAGE 1 -->
<div class="page">
  <div class="agr-logo-header"><img src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'"></div>
  <div class="agreement-body" style="padding:6mm 14mm">
    <div style="position:relative;text-align:center;margin-bottom:4mm">
      <img class="stamp" src="${esc(stamp)}" alt="Revenue stamp" style="max-height:22mm;object-fit:contain;margin:0 auto" onerror="this.style.display='none'">
      <div style="position:absolute;right:0;top:0;font-weight:700;font-size:11px">Annexure 2</div>
    </div>
    
    <p style="text-align:center;font-size:12px;font-weight:700;line-height:1.4;margin:4mm 0">
      Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project<br>
      under PM – Surya Ghar: Muft Bijli Yojana
    </p>
    
    <p>This agreement is executed on <b>${esc(displayDate)}</b> for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana.</p>
    
    <p style="text-align:center;margin:3mm 0"><b>Between</b></p>
    
    <p><b>${esc(customer.name || "Consumer")}</b> having address <b>${address}</b> (herein referred to as First Party i.e. Consumer / purchaser / owner of system).</p>
    
    <p style="text-align:center;margin:3mm 0"><b>And</b></p>
    
    <p><b>A1 SOLAR SOLUTION</b>, the Vendor / contractor / System Integrator (hereinafter referred to as Second Party).</p>
    
    <p><b>Whereas</b> the First Party wishes to install a Grid Connected Rooftop Solar Plant under PM Surya Ghar: Muft Bijli Yojana and the Second Party has verified feasibility and is willing to design, supply, install, test, commission and maintain the system.</p>
    
    <p><b>The First Party undertakes to:</b></p>
    <ol style="padding-left:18px;margin:2mm 0">
      <li>Submit required National Portal, net-metering and inspection applications and documents.</li>
      <li>Provide secure storage of delivered RTS material until system handover.</li>
      <li>Provide safe rooftop access during installation, testing, operation and maintenance.</li>
      <li>Provide electricity and water required during installation and panel cleaning.</li>
      <li>Report malfunction during warranty and pay amounts according to the mutually agreed schedule.</li>
    </ol>
    
    <p style="font-weight:700;margin-top:5mm;margin-bottom:2mm">Approved Products / System Components</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #333;font-size:10.5px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="border:1px solid #333;padding:5px;text-align:left;width:35px">#</th>
          <th style="border:1px solid #333;padding:5px;text-align:left">Product Name</th>
          <th style="border:1px solid #333;padding:5px;text-align:left">Brand / Model</th>
          <th style="border:1px solid #333;padding:5px;text-align:left;width:90px">Quantity</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="4" style="border:1px solid #333;padding:8px">Products are recorded in the linked quotation.</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="agr-logo-header"><img src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'"></div>
  <div class="agreement-body" style="padding:6mm 14mm">
    <p style="margin-bottom:4mm">The Vendor must follow all standards and safety guidelines prescribed under State regulations, DISCOM/SERC/MNRE requirements and applicable technical standards.</p>
    
    <p class="clause"><b>Site Survey:</b> Site visit, feasibility study, roof-strength and shadow-free-area assessment. Additional customization required by site conditions shall be separately estimated with applicable tax.</p>
    
    <p class="clause"><b>Design &amp; Engineering:</b> Plant design, drawings and component selection shall follow standards prescribed by DISCOM/SERC/MNRE for performance and safety.</p>
    
    <p class="clause"><b>Module and Inverter:</b> Modules and inverters shall conform to relevant MNRE, BIS/IS/IEC and quality-control requirements.</p>
    
    <p class="clause"><b>Procurement &amp; Supply:</b> Complete system shall comply with applicable standards and subsidy-release requirements.</p>
    
    <p class="clause"><b>Installation &amp; Civil Work:</b> Civil, structure and electrical work within the approved scope shall follow relevant safety standards.</p>
    
    <p class="clause"><b>Documentation:</b> Technical catalogues, warranty certificates, BIS certificates, serial numbers, layout, electrical SLD, structure drawings and other required reports shall be provided.</p>
    
    <p class="clause"><b>Project Completion Report:</b> Vendor shall assist the Consumer in completion and uploading of signed project documents.</p>
    
    <p class="clause"><b>Warranty:</b> Complete system warranty and individual manufacturer warranty documents shall be supplied. Applicable support will be provided for warranty claims.</p>
    
    <p class="clause"><b>Net Meter &amp; Grid Connectivity:</b> Supply/procurement, testing and approval responsibilities shall follow the finalized project scope and DISCOM requirements.</p>
    
    <p class="clause"><b>Operation &amp; Maintenance:</b> Vendor shall provide agreed maintenance support and the Consumer shall ensure reasonable access and routine cleaning conditions.</p>
  </div>
</div>

<!-- PAGE 3 -->
<div class="page">
  <div class="agr-logo-header"><img src="${esc(logoUrl)}" alt="A1 Solar Solution" onerror="this.style.display='none'"></div>
  <div class="agreement-body" style="padding:6mm 14mm">
    <p class="clause"><b>Dispute:</b> Any dispute between Consumer and Vendor relating to supply, installation, maintenance or payment shall be settled mutually or according to applicable law. MNRE/DISCOM shall not be a party to such private dispute.</p>
    
    <p class="clause"><b>Subsidy / Project Related Documents:</b> Vendor shall provide relevant documents and assist with National Portal submission for subsidy processing.</p>
    
    <p class="clause"><b>Performance of Plant:</b> Plant performance shall meet applicable commissioning requirements and the finalized technical specification.</p>
    
    <p class="clause"><b>Mutually Agreed Terms of Payment:</b> ${esc(merged.terms_of_payment || row.terms_of_payment || "dgf")}</p>
    
    <table style="width:100%;border-collapse:collapse;border:1px solid #333;font-size:10.5px;margin:6mm 0">
      <tr>
        <th style="border:1px solid #333;padding:5px;text-align:left;background:#f9f9f9;width:25%">Agreement #</th>
        <td style="border:1px solid #333;padding:5px;width:25%">${esc(row.agreement_number)}</td>
        <th style="border:1px solid #333;padding:5px;text-align:left;background:#f9f9f9;width:25%">Quotation #</th>
        <td style="border:1px solid #333;padding:5px;width:25%">${esc(row.quotation_number || "AI-QUO-0101")}</td>
      </tr>
      <tr>
        <th style="border:1px solid #333;padding:5px;text-align:left;background:#f9f9f9">System Capacity</th>
        <td style="border:1px solid #333;padding:5px">${esc(row.capacity_kw || merged.capacity_kw || "25")} kW</td>
        <th style="border:1px solid #333;padding:5px;text-align:left;background:#f9f9f9">Project Value</th>
        <td style="border:1px solid #333;padding:5px">${inr(row.payment_amount || row.project_value || 1232000)}</td>
      </tr>
    </table>
    
    <div class="party-grid" style="margin-top:12mm">
      <div class="sig-box">
        <b>First Party (Consumer)</b>
        <p style="margin:2mm 0">Name: ${esc(customer.name || "Meera Enterprises")}<br>Address: ${address}</p>
        ${customerSigHtml}
        <div class="a-line" style="margin-top:18mm;border-top:1px solid #333;padding-top:2mm">Consumer Signature<br>Date: ${esc(displayDate)}</div>
      </div>
      <div class="sig-box">
        <b>Second Party (Vendor)</b>
        <p style="margin:2mm 0">Name: A1 SOLAR SOLUTION<br>Authorized Vendor</p>
        <img style="height:18mm;max-width:55mm;object-fit:contain;display:block;margin:2mm 0;print-color-adjust:exact;-webkit-print-color-adjust:exact" src="${esc(vendorSign)}" alt="Vendor signature" onerror="this.style.display='none'">
        <div class="a-line" style="margin-top:4mm;border-top:1px solid #333;padding-top:2mm">Vendor Signature<br>Date: ${esc(displayDate)}</div>
      </div>
    </div>
    
    <p class="disclaimer" style="margin-top:12mm;border-top:1px solid #aaa;padding-top:2mm;font-size:9px"><b>Disclaimer:</b> This agreement is between Vendor and Consumer. Any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p>
  </div>
</div>

</main>
<button class="actions" onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}
