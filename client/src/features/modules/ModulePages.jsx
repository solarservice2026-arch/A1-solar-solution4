import { BarChart3, FileText, Package, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  agreementDocument,
  invoiceDocument,
  quotationDocument,
} from "../documents/templates.js";

const text = (v) => (v == null ? "—" : String(v));
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const formObject = (form) => {
  const result = {};
  new FormData(form).forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const printRecord = async (title, row) => {
  if (title === "Agreement" && (row.locked || row.payment_status !== "Paid")) {
    return toast.error("PayU Payment required before viewing/downloading agreement.");
  }
  let recordData = row;
  if (title === "Agreement") {
    try {
      const docRes = await api(`/agreements/${row.id}/document`);
      recordData = docRes;
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Document fetch failed");
    }
  }
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return toast.error("Allow pop-ups to print PDF");
  const html =
    title === "Quotation"
      ? quotationDocument(recordData)
      : title === "Agreement"
        ? agreementDocument(recordData)
        : invoiceDocument(recordData);
  popup.document.write(html);
  popup.document.close();
};

function DataPage({
  title,
  kicker,
  description,
  path,
  permission,
  columns,
  fields,
  icon,
  printable = false,
  deletePermission,
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payuRow, setPayuRow] = useState(null);
  const [paying, setPaying] = useState(false);

  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCustomers, setAvailableCustomers] = useState([]);
  const [isCustomCustomer, setIsCustomCustomer] = useState(false);

  useEffect(() => {
    if (open && (title === "Quotations" || title === "Invoices" || title === "Agreements")) {
      const fetchData = async () => {
        try {
          if (title === "Quotations" || title === "Invoices") {
            const res = await api("/products");
            if (Array.isArray(res)) setAvailableProducts(res);
          }
          const custRes = await api("/customers");
          if (Array.isArray(custRes)) setAvailableCustomers(custRes);
        } catch (e) {
          console.error("Failed to load data", e);
        }
      };
      void fetchData();
    }
    if (!open) {
      setIsCustomCustomer(false);
    }
  }, [open, title]);

  // ─── CUSTOM FORMS STATES ───
  // Quotation States
  const [qNumber, setQNumber] = useState("SEQ-0094");
  const [qDate, setQDate] = useState("2026-04-25");
  const [qCapacity, setQCapacity] = useState("3");
  const [qType, setQType] = useState("ON-GRID SOLAR POWER SYSTEM");
  const [qCustName, setQCustName] = useState("ARJUN CHAUDHARY");
  const [qCustMobile, setQCustMobile] = useState("9955964771");
  const [qCustEmail, setQCustEmail] = useState("");
  const [qCustGst, setQCustGst] = useState("");
  const [qAddress, setQAddress] = useState("NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503");
  const [qValid, setQValid] = useState("2026-05-25");
  const [qItems, setQItems] = useState([
    { productName: "Solar Panel", description: "Mono-Halfcut 545 Watt DCR", brand: "LivFast", quantity: "6", unitPrice: 22000 },
    { productName: "Inverter", description: "ON GRID 3 KVA", brand: "LivFast", quantity: "1", unitPrice: 43000 },
    { productName: "Structure", description: "Ms/GI", brand: "Branded", quantity: "3KW", unitPrice: 14000 },
    { productName: "ACDB & DCDB Earthing La Ac Wire Dc Wire", description: "For 3KW", brand: "Branded", quantity: "3/KW", unitPrice: 9000 }
  ]);
  const [qCustomerSignature, setQCustomerSignature] = useState(null);

  const handleQSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setQCustomerSignature(ev.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setQCustomerSignature(null);
    }
  };

  // Invoice States
  const [iNumber, setINumber] = useState("A1-F1DBAC3B");
  const [iTitle, setITitle] = useState("FOR 5KW MOUNTING STRUCTURE — OFF-GRID");
  const [iCustName, setICustName] = useState("Rohan Sharma");
  const [iCustMobile, setICustMobile] = useState("9876500001");
  const [iCustEmail, setICustEmail] = useState("customer.home@a1solar.test");
  const [iCustGst, setICustGst] = useState("sdfsdf");
  const [iAddress, setIAddress] = useState("VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR");
  const [iDate, setIDate] = useState("2026-07-29");
  const [iDueDate, setIDueDate] = useState("2026-07-29");
  const [iPaidAmount, setIPaidAmount] = useState("0");
  const [iStatus, setIStatus] = useState("Unpaid");
  const [iItems, setIItems] = useState([
    { productName: "5kW Mounting Structure", description: "MS-5K — Structure", brand: "A1 Fabrication", quantity: "1", unitPrice: 34000 }
  ]);

  // Agreement States
  const [aNumber, setANumber] = useState("AGR-20260425-8A2F");
  const [aDate, setADate] = useState("2026-04-25");
  const [aCustName, setACustName] = useState("ARJUN CHAUDHARY");
  const [aCustMobile, setACustMobile] = useState("9955964771");
  const [aCustEmail, setACustEmail] = useState("");
  const [aAddress, setAAddress] = useState("NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503");
  const [aQuotationNumber, setAQuotationNumber] = useState("SEQ-0094");
  const [aCapacity, setACapacity] = useState("3");
  const [aAmount, setAAmount] = useState("244000");
  const [aTerms, setATerms] = useState("70% advance payment shall be made at the time of order confirmation. Remaining 30% payment shall be made immediately after installation completion. All payments must be made through Bank Transfer / UPI / Cheque only. Any delay in payment may result in project delay or suspension of service.");
  const [aCustomerSignature, setACustomerSignature] = useState(null);

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setACustomerSignature(ev.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setACustomerSignature(null);
    }
  };

  const canCreate =
    user?.roles?.includes("super_admin") ||
    user?.permissions?.includes(permission);

  const canDelete = Boolean(
    deletePermission &&
    (user?.roles?.includes("super_admin") ||
      user?.permissions?.includes(deletePermission)),
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await api(
        `${path}${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      );
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [path]);

  const submit = async (e) => {
    e.preventDefault();
    let body = {};

    if (title === "Quotations") {
      const subtotal = qItems.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
      const tax = Math.round(subtotal * 0.18);
      body = {
        quotationNumber: qNumber,
        quotationDate: qDate,
        capacityKw: qCapacity,
        quotationType: qType,
        customerName: qCustName,
        customerMobile: qCustMobile,
        customerEmail: qCustEmail,
        customerGst: qCustGst,
        consumerAddress: qAddress,
        validUntil: qValid,
        items: qItems,
        tax,
        subtotal,
        discount: 0,
        grandTotal: subtotal + tax,
        status: "Draft",
        customerSignatureUrl: qCustomerSignature
      };
    } else if (title === "Invoices") {
      const subtotal = iItems.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
      const tax = Math.round(subtotal * 0.18);
      body = {
        invoiceNumber: iNumber,
        title: iTitle,
        customerName: iCustName,
        customerMobile: iCustMobile,
        customerEmail: iCustEmail,
        customerGst: iCustGst,
        consumerAddress: iAddress,
        invoiceDate: iDate,
        dueDate: iDueDate,
        paidAmount: iPaidAmount,
        status: iStatus,
        items: iItems,
        tax,
        total: subtotal + tax
      };
    } else if (title === "Agreements") {
      body = {
        agreementNumber: aNumber,
        agreementDate: aDate,
        customerName: aCustName,
        customerMobile: aCustMobile,
        customerEmail: aCustEmail,
        consumerAddress: aAddress,
        quotationNumber: aQuotationNumber,
        capacityKw: aCapacity,
        paymentAmount: aAmount,
        termsOfPayment: aTerms,
        status: "Draft",
        customerSignatureUrl: aCustomerSignature
      };
    } else {
      body = formObject(e.currentTarget);
    }

    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(`${title.slice(0, -1)} created`);
      setOpen(false);
      await load();
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Unable to create");
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete this ${title.toLowerCase().slice(0, -1)}?`)) return;
    try {
      await api(`${path}/${row.id}`, { method: "DELETE" });
      toast.success("Deleted successfully");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Item list helper functions
  const addQItem = () => setQItems([...qItems, { productName: "", description: "", brand: "", quantity: "1", unitPrice: 0 }]);
  const removeQItem = (idx) => setQItems(qItems.filter((_, i) => i !== idx));
  const updateQItem = (idx, key, val) => {
    const next = [...qItems];
    next[idx][key] = val;
    setQItems(next);
  };

  const addIItem = () => setIItems([...iItems, { productName: "", description: "", brand: "", quantity: "1", unitPrice: 0 }]);
  const removeIItem = (idx) => setIItems(iItems.filter((_, i) => i !== idx));
  const updateIItem = (idx, key, val) => {
    const next = [...iItems];
    next[idx][key] = val;
    setIItems(next);
  };

  return (
    <main className="app-page">
      <div className="page-bar">
        <div>
          <span className="kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {canCreate && fields && (
          <button className="primary" onClick={() => setOpen(true)}>
            New {title.slice(0, -1)}
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          placeholder={`Search ${title.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => void load()}>Search</button>
      </div>

      {open && fields && (
        <div className="modal-backdrop">
          {title === "Quotations" ? (
            <form className="card modal-form" style={{ maxWidth: "920px", width: "95%", maxHeight: "92vh", overflowY: "auto", padding: "28px" }} onSubmit={submit}>
              <h2 style={{ margin: "0 0 20px", fontSize: "20px" }}>Create Premium Quotation</h2>
              <div className="create-form-grid">
                <label>Quote Number<input value={qNumber} onChange={e => setQNumber(e.target.value)} required /></label>
                <label>Quotation Date<input type="date" value={qDate} onChange={e => setQDate(e.target.value)} required /></label>
                <label>System Capacity (kW)<input type="number" value={qCapacity} onChange={e => setQCapacity(e.target.value)} required /></label>
                <label>Quotation Type<input value={qType} onChange={e => setQType(e.target.value)} required /></label>
                <label>Customer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={qCustName} onChange={e => setQCustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); setQCustName(""); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={availableCustomers.some(c => c.name === qCustName) ? qCustName : ""}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setIsCustomCustomer(true);
                          setQCustName("");
                        } else {
                          setQCustName(val);
                          const customer = availableCustomers.find(c => c.name === val);
                          if (customer) {
                            setQCustMobile(customer.mobile || "");
                            setQCustEmail(customer.email || "");
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Customer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      <option value="custom">+ Add Custom Name</option>
                    </select>
                  )}
                </label>
                <label>Customer Mobile<input value={qCustMobile} onChange={e => setQCustMobile(e.target.value)} required /></label>
                <label>Customer Email<input type="email" value={qCustEmail} onChange={e => setQCustEmail(e.target.value)} /></label>
                <label>Customer GSTIN<input value={qCustGst} onChange={e => setQCustGst(e.target.value)} /></label>
                <label className="span-2">Installation Address<textarea value={qAddress} onChange={e => setQAddress(e.target.value)} rows={2} required /></label>
                <label>Valid Until<input type="date" value={qValid} onChange={e => setQValid(e.target.value)} required /></label>
                <label className="span-2">Customer Signature
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                    <input type="file" accept="image/*" onChange={handleQSignatureUpload} />
                    {qCustomerSignature && <img src={qCustomerSignature} alt="Signature Preview" style={{ height: "40px", border: "1px solid #ddd", borderRadius: "4px" }} />}
                  </div>
                </label>
              </div>

              <h3 className="section-divider">Quotation Items</h3>
              <div className="items-responsive-table">
                <table>
                  <thead>
                    <tr style={{ background: "#f0f4fb" }}>
                      <th>#</th>
                      <th>Product</th>
                      <th>Description</th>
                      <th>Brand/Model</th>
                      <th style={{ width: "70px", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Price (₹)</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {qItems.map((item, idx) => {
                      const lineAmt = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      return (
                        <tr key={idx}>
                          <td style={{ color: "#888", fontSize: "12px", verticalAlign: "top", paddingTop: "14px" }}>{idx + 1}</td>
                          <td>
                            <select
                              style={{ width: "100%", marginBottom: "5px" }}
                              value={item.productId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === "custom") {
                                  updateQItem(idx, "productId", "custom");
                                } else {
                                  const found = availableProducts.find(p => p.id === val);
                                  if (found) {
                                    const next = [...qItems];
                                    next[idx] = {
                                      ...next[idx],
                                      productId: val,
                                      productName: found.name,
                                      description: `${found.category || ""} - ${found.name}`,
                                      brand: found.brand || "",
                                      unitPrice: found.selling_price || 0
                                    };
                                    setQItems(next);
                                  }
                                }
                              }}
                            >
                              <option value="">-- Choose Product --</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.brand}) - ₹{p.selling_price}</option>
                              ))}
                              <option value="custom">-- Custom Product --</option>
                            </select>
                            {(item.productId === "custom" || !item.productId || availableProducts.length === 0) && (
                              <input
                                placeholder="Type product name"
                                style={{ width: "100%" }}
                                value={item.productName}
                                onChange={e => updateQItem(idx, "productName", e.target.value)}
                                required
                              />
                            )}
                          </td>
                          <td><input style={{ width: "100%" }} value={item.description} onChange={e => updateQItem(idx, "description", e.target.value)} required /></td>
                          <td><input style={{ width: "100%" }} value={item.brand} onChange={e => updateQItem(idx, "brand", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center" }} value={item.quantity} onChange={e => updateQItem(idx, "quantity", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", textAlign: "right" }} type="number" value={item.unitPrice} onChange={e => updateQItem(idx, "unitPrice", Number(e.target.value))} required /></td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#1a3a6b", verticalAlign: "top", paddingTop: "14px" }}>₹{lineAmt.toLocaleString("en-IN")}</td>
                          <td><button type="button" className="danger" style={{ padding: "5px 10px" }} onClick={() => removeQItem(idx)}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="secondary" style={{ marginBottom: "16px", marginTop: "10px" }} onClick={addQItem}>+ Add Item</button>

              {/* Live Total Summary */}
              {(() => {
                const sub = qItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
                const tax = Math.round(sub * 0.18);
                const grand = sub + tax;
                return (
                  <div className="live-total-box">
                    <div className="live-total-row"><span>Subtotal</span><span>₹{sub.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row"><span>GST 18%</span><span>₹{tax.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row grand"><span>Grand Total</span><span>₹{grand.toLocaleString("en-IN")}</span></div>
                  </div>
                );
              })()}

              <div className="row-actions" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", marginTop: "16px" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="primary">Create Quotation</button>
              </div>
            </form>
          ) : title === "Invoices" ? (
            <form className="card modal-form" style={{ maxWidth: "920px", width: "95%", maxHeight: "92vh", overflowY: "auto", padding: "28px" }} onSubmit={submit}>
              <h2 style={{ margin: "0 0 20px", fontSize: "20px" }}>Create Invoice</h2>
              <div className="create-form-grid">
                <label>Invoice Number<input value={iNumber} onChange={e => setINumber(e.target.value)} required /></label>
                <label>Invoice Title<input value={iTitle} onChange={e => setITitle(e.target.value)} required /></label>
                <label>Invoice Date<input type="date" value={iDate} onChange={e => setIDate(e.target.value)} required /></label>
                <label>Due Date<input type="date" value={iDueDate} onChange={e => setIDueDate(e.target.value)} required /></label>
                <label>Customer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={iCustName} onChange={e => setICustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); setICustName(""); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={availableCustomers.some(c => c.name === iCustName) ? iCustName : ""}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setIsCustomCustomer(true);
                          setICustName("");
                        } else {
                          setICustName(val);
                          const customer = availableCustomers.find(c => c.name === val);
                          if (customer) {
                            setICustMobile(customer.mobile || "");
                            setICustEmail(customer.email || "");
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Customer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      <option value="custom">+ Add Custom Name</option>
                    </select>
                  )}
                </label>
                <label>Customer Mobile<input value={iCustMobile} onChange={e => setICustMobile(e.target.value)} required /></label>
                <label>Customer Email<input type="email" value={iCustEmail} onChange={e => setICustEmail(e.target.value)} /></label>
                <label>Customer GSTIN<input value={iCustGst} onChange={e => setICustGst(e.target.value)} /></label>
                <label className="span-2">Billing Address<textarea value={iAddress} onChange={e => setIAddress(e.target.value)} rows={2} required /></label>
                <label>Paid Amount (₹)<input type="number" value={iPaidAmount} onChange={e => setIPaidAmount(e.target.value)} required /></label>
                <label>Status
                  <select value={iStatus} onChange={e => setIStatus(e.target.value)}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                    <option value="Draft">Draft</option>
                  </select>
                </label>
              </div>

              <h3 className="section-divider">Invoice Items</h3>
              <div className="items-responsive-table">
                <table>
                  <thead>
                    <tr style={{ background: "#f0f4fb" }}>
                      <th>#</th>
                      <th>Product</th>
                      <th>Description</th>
                      <th>Brand/Model</th>
                      <th style={{ width: "70px", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Price (₹)</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {iItems.map((item, idx) => {
                      const lineAmt = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      return (
                        <tr key={idx}>
                          <td style={{ color: "#888", fontSize: "12px", verticalAlign: "top", paddingTop: "14px" }}>{idx + 1}</td>
                          <td>
                            <select
                              style={{ width: "100%", marginBottom: "5px" }}
                              value={item.productId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === "custom") {
                                  updateIItem(idx, "productId", "custom");
                                } else {
                                  const found = availableProducts.find(p => p.id === val);
                                  if (found) {
                                    const next = [...iItems];
                                    next[idx] = {
                                      ...next[idx],
                                      productId: val,
                                      productName: found.name,
                                      description: `${found.category || ""} - ${found.name}`,
                                      brand: found.brand || "",
                                      unitPrice: found.selling_price || 0
                                    };
                                    setIItems(next);
                                  }
                                }
                              }}
                            >
                              <option value="">-- Choose Product --</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.brand}) - ₹{p.selling_price}</option>
                              ))}
                              <option value="custom">-- Custom Product --</option>
                            </select>
                            {(item.productId === "custom" || !item.productId || availableProducts.length === 0) && (
                              <input
                                placeholder="Type product name"
                                style={{ width: "100%" }}
                                value={item.productName}
                                onChange={e => updateIItem(idx, "productName", e.target.value)}
                                required
                              />
                            )}
                          </td>
                          <td><input style={{ width: "100%" }} value={item.description} onChange={e => updateIItem(idx, "description", e.target.value)} required /></td>
                          <td><input style={{ width: "100%" }} value={item.brand} onChange={e => updateIItem(idx, "brand", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center" }} type="number" value={item.quantity} onChange={e => updateIItem(idx, "quantity", Number(e.target.value))} required /></td>
                          <td><input style={{ width: "100%", textAlign: "right" }} type="number" value={item.unitPrice} onChange={e => updateIItem(idx, "unitPrice", Number(e.target.value))} required /></td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#1a3a6b", verticalAlign: "top", paddingTop: "14px" }}>₹{lineAmt.toLocaleString("en-IN")}</td>
                          <td><button type="button" className="danger" style={{ padding: "5px 10px" }} onClick={() => removeIItem(idx)}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="secondary" style={{ marginBottom: "16px", marginTop: "10px" }} onClick={addIItem}>+ Add Item</button>

              {/* Live Total Summary */}
              {(() => {
                const sub = iItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
                const tax = Math.round(sub * 0.18);
                const grand = sub + tax;
                const paid = Number(iPaidAmount) || 0;
                const balance = Math.max(0, grand - paid);
                return (
                  <div className="live-total-box">
                    <div className="live-total-row"><span>Subtotal</span><span>₹{sub.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row"><span>GST 18%</span><span>₹{tax.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row grand"><span>Grand Total</span><span>₹{grand.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row"><span>Paid Amount</span><span>₹{paid.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row balance"><span>Balance Due</span><span>₹{balance.toLocaleString("en-IN")}</span></div>
                  </div>
                );
              })()}

              <div className="row-actions" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", marginTop: "16px" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="primary">Create Invoice</button>
              </div>
            </form>
          ) : title === "Agreements" ? (
            <form className="card modal-form" style={{ maxWidth: "780px", width: "95%", maxHeight: "90vh", overflowY: "auto" }} onSubmit={submit}>
              <h2>Create Agreement</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <label>Agreement Number<input value={aNumber} onChange={e => setANumber(e.target.value)} required /></label>
                <label>Agreement Date<input type="date" value={aDate} onChange={e => setADate(e.target.value)} required /></label>
                <label>Consumer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={aCustName} onChange={e => setACustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); setACustName(""); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={availableCustomers.some(c => c.name === aCustName) ? aCustName : ""}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setIsCustomCustomer(true);
                          setACustName("");
                        } else {
                          setACustName(val);
                          const customer = availableCustomers.find(c => c.name === val);
                          if (customer) {
                            setACustMobile(customer.mobile || "");
                            setACustEmail(customer.email || "");
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Consumer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      <option value="custom">+ Add Custom Name</option>
                    </select>
                  )}
                </label>
                <label>Consumer Mobile<input value={aCustMobile} onChange={e => setACustMobile(e.target.value)} required /></label>
                <label>Consumer Email<input type="email" value={aCustEmail} onChange={e => setACustEmail(e.target.value)} /></label>
                <label>Quotation Reference #<input value={aQuotationNumber} onChange={e => setAQuotationNumber(e.target.value)} required /></label>
                <label>System Capacity (kW)<input type="number" value={aCapacity} onChange={e => setACapacity(e.target.value)} required /></label>
                <label>Project Value (₹)<input type="number" value={aAmount} onChange={e => setAAmount(e.target.value)} required /></label>
                <label style={{ gridColumn: "span 2" }}>Consumer Site Address<textarea value={aAddress} onChange={e => setAAddress(e.target.value)} rows={2} required /></label>
                <label style={{ gridColumn: "span 2" }}>Terms of Payment<textarea value={aTerms} onChange={e => setATerms(e.target.value)} rows={3} required /></label>
                <label style={{ gridColumn: "span 2" }}>
                  Customer Signature (Image)
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} style={{ marginTop: "4px" }} />
                  {aCustomerSignature && <img src={aCustomerSignature} alt="Signature Preview" style={{ height: "40px", marginTop: "8px", objectFit: "contain", display: "block" }} />}
                </label>
              </div>

              <div className="row-actions" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", marginTop: "20px" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="primary">Create Agreement</button>
              </div>
            </form>
          ) : (
            <form className="card modal-form" onSubmit={submit}>
              <h2>Create {title.slice(0, -1)}</h2>
              {fields.map(([name, label, type, options, req]) => (
                <label key={name}>
                  {label}
                  {type === "select" ? (
                    <select name={name} required={req !== false}>
                      {options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={name}
                      type={type}
                      required={req !== false && type !== "password"}
                      placeholder={type === "password" ? "Default: admin123" : undefined}
                    />
                  )}
                </label>
              ))}
              <div className="row-actions">
                <button type="button" className="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="primary">Create</button>
              </div>
            </form>
          )}
        </div>
      )}

      {payuRow && (
        <div className="modal-backdrop">
          <div className="card modal-form" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>PayU Online Gateway</h2>
              <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                PayU Official
              </span>
            </div>
            <p style={{ margin: "8px 0 12px", color: "#4b5563", fontSize: "13px" }}>
              Complete payment for <strong>Agreement #{payuRow.agreement_number}</strong> to unlock PDF download.
            </p>
            
            <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb", margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span>Customer:</span>
                <strong>{payuRow.customers?.name || payuRow.customer_name || "Customer"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span>Agreement #:</span>
                <strong>{payuRow.agreement_number}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", color: "#059669", paddingTop: "8px", borderTop: "1px dashed #d1d5db", marginTop: "6px" }}>
                <span>Total Amount Payable:</span>
                <strong>₹{Number(payuRow.payment_amount || 1232000).toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div style={{ background: "#eff6ff", padding: "10px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1e40af", marginBottom: "16px" }}>
              💳 <strong>Supported Methods:</strong> PayU UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking &amp; Wallets.
            </div>

            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setPayuRow(null)} disabled={paying}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                style={{ background: "#10b981", borderColor: "#059669", color: "#fff", fontWeight: 700 }}
                disabled={paying}
                onClick={async () => {
                  setPaying(true);
                  try {
                    await api(`/agreements/${payuRow.id}/payu-verify`, {
                      method: "POST",
                      body: JSON.stringify({ txnid: `PAYU_${Date.now()}` }),
                    });
                    toast.success("PayU Payment Verified! Agreement Unlocked 🎉");
                    setPayuRow(null);
                    await load();
                    const docRes = await api(`/agreements/${payuRow.id}/document`);
                    const popup = window.open("", "_blank", "width=900,height=700");
                    if (popup) {
                      popup.document.write(agreementDocument(docRes));
                      popup.document.close();
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "PayU payment failed");
                  } finally {
                    setPaying(false);
                  }
                }}
              >
                {paying ? "Processing PayU…" : "Pay Now via PayU 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton">Loading {title.toLowerCase()}…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          {icon}
          <h2>No {title.toLowerCase()} found</h2>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map(([_, label]) => (
                  <th key={label}>{label}</th>
                ))}
                {(printable || canDelete) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isAgreementLocked = title === "Agreements" && (row.locked || row.payment_status !== "Paid");
                return (
                  <tr key={row.id}>
                    {columns.map(([key, _, fmt]) => (
                      <td key={key}>{fmt ? fmt(row[key]) : text(row[key])}</td>
                    ))}
                    {(printable || canDelete) && (
                      <td>
                        <div className="row-actions">
                          {printable && (
                            isAgreementLocked ? (
                              <button
                                type="button"
                                className="primary"
                                style={{ background: "#10b981", borderColor: "#059669", color: "#fff", fontWeight: 700, padding: "5px 10px", fontSize: "12px" }}
                                onClick={() => setPayuRow(row)}
                              >
                                🔒 Pay via PayU
                              </button>
                            ) : (
                              <button className="secondary" onClick={() => void printRecord(title.slice(0, -1), row)}>
                                Print / PDF
                              </button>
                            )
                          )}
                          {canDelete && (
                            <button className="danger" onClick={() => void remove(row)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function CustomersPage() {
  return (
    <DataPage
      title="Customers"
      kicker="CRM"
      description="Manage solar customers, contact profiles, user roles and login accounts."
      path="/customers"
      permission="customers:create"
      deletePermission="customers:delete"
      columns={[
        ["customer_number", "Customer #"],
        ["name", "Name"],
        ["mobile", "Mobile"],
        ["customer_type", "Type / Role"],
        ["status", "Status"],
      ]}
      fields={[
        ["name", "Full Name", "text"],
        ["mobile", "Mobile Number", "text"],
        ["email", "Email Address", "email", null, false],
        ["password", "Password", "password", null, false],
        [
          "customerType",
          "Customer Type / Role",
          "select",
          [
            "Customer",
          ],
        ],
      ]}
      icon={<Users />}
    />
  );
}

export function ProductsPage() {
  return (
    <DataPage
      title="Products"
      kicker="INVENTORY"
      description="Catalog of solar panels, inverters, structures and components."
      path="/products"
      permission="products:create"
      deletePermission="products:delete"
      columns={[
        ["sku", "SKU"],
        ["name", "Product Name"],
        ["category", "Category"],
        ["brand", "Brand"],
        ["selling_price", "Selling Price", money],
      ]}
      fields={[
        ["name", "Product Name", "text"],
        ["category", "Category", "text"],
        ["brand", "Brand", "text"],
        ["sellingPrice", "Selling Price", "number"],
      ]}
      icon={<Package />}
    />
  );
}

export function ProjectsPage() {
  return (
    <DataPage
      title="Installations"
      kicker="OPERATIONS"
      description="Track solar rooftop installation progress and stages."
      path="/projects"
      permission="projects:create"
      columns={[
        ["project_number", "Project #"],
        ["stage", "Stage"],
        ["progress", "Progress (%)"],
        ["created_at", "Date", (v) => new Date(v).toLocaleDateString("en-IN")],
      ]}
      icon={<Package />}
    />
  );
}

export function TicketsPage() {
  return (
    <DataPage
      title="Service Tickets"
      kicker="SUPPORT"
      description="Track service maintenance and warranty claims."
      path="/tickets"
      permission="tickets:create"
      columns={[
        ["ticket_number", "Ticket #"],
        ["subject", "Subject"],
        ["status", "Status"],
        ["priority", "Priority"],
      ]}
      icon={<FileText />}
    />
  );
}

export function QuotationsPage() {
  return (
    <DataPage
      title="Quotations"
      kicker="SALES"
      description="Generate and print official solar installation quotations."
      path="/quotations"
      permission="quotations:create"
      deletePermission="quotations:delete"
      printable
      columns={[
        ["quotation_number", "Quotation #"],
        ["customer_name", "Customer"],
        ["capacity_kw", "Capacity (kW)"],
        ["grand_total", "Grand Total", money],
        ["status", "Status"],
      ]}
      fields={[
        ["customerName", "Customer Name", "text"],
        ["capacityKw", "System Capacity (kW)", "number"],
        ["grandTotal", "Grand Total (₹)", "number"],
        ["consumerAddress", "Installation Address", "text"],
        ["status", "Status", "select", ["Draft", "Sent", "Approved", "Rejected"]],
      ]}
      icon={<FileText />}
    />
  );
}

export function InvoicesPage() {
  return (
    <DataPage
      title="Invoices"
      kicker="FINANCE"
      description="Tax invoices and billing records for customers."
      path="/invoices"
      permission="invoices:create"
      deletePermission="invoices:delete"
      printable
      columns={[
        ["invoice_number", "Invoice #"],
        ["title", "Title"],
        ["total", "Total Amount", money],
        ["paid_amount", "Paid Amount", money],
        ["status", "Status"],
      ]}
      fields={[
        ["title", "Invoice Title", "text"],
        ["customerName", "Customer Name", "text"],
        ["total", "Total Amount (₹)", "number"],
        ["paidAmount", "Paid Amount (₹)", "number"],
        ["tax", "Tax / GST (₹)", "number"],
        ["dueDate", "Due Date", "date"],
        ["status", "Status", "select", ["Draft", "Sent", "Paid", "Overdue", "Cancelled"]],
      ]}
      icon={<FileText />}
    />
  );
}

export function AgreementsPage() {
  return (
    <DataPage
      title="Agreements"
      kicker="LEGAL & CONTRACTS"
      description="PM Surya Ghar Muft Bijli Yojana installation agreements."
      path="/agreements"
      permission="agreements:create"
      deletePermission="agreements:delete"
      printable
      columns={[
        ["agreement_number", "Agreement #"],
        ["customer_name", "Customer"],
        ["payment_status", "Payment Status"],
        ["payment_amount", "Amount", money],
        ["status", "Status"],
      ]}
      fields={[
        ["customerName", "Customer Name", "text"],
        ["paymentAmount", "Project / Payment Amount (₹)", "number"],
        ["consumerAddress", "Consumer Address", "text"],
        ["quotationId", "Quotation # (optional)", "text", null, false],
        ["agreementDate", "Agreement Date", "date"],
      ]}
      icon={<FileText />}
    />
  );
}

export function SettingsPage() {
  return (
    <main className="app-page">
      <span className="kicker">SYSTEM</span>
      <h1>Settings</h1>
      <div className="card">
        <h2>Company Information</h2>
        <p>A1 Solar Solution — Premier Solar EPC & Installation Provider</p>
      </div>
    </main>
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  const profile = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone") || null,
        }),
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    }
  };

  const password = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api("/profile/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      toast.success("Password updated successfully");
      formEl.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password update failed");
    }
  };

  return (
    <main className="app-page">
      <span className="kicker">MY ACCOUNT</span>
      <h1>Profile & security</h1>
      <div className="detail-grid">
        <form className="card operational-form" onSubmit={profile}>
          <h2>Profile</h2>
          <label>
            Full name
            <input name="fullName" defaultValue={user?.fullName} required />
          </label>
          <label>
            Phone
            <input name="phone" />
          </label>
          <button className="primary">Update profile</button>
        </form>
        <form className="card operational-form" onSubmit={password}>
          <h2>Change password</h2>
          <label>
            Current password
            <input name="currentPassword" type="password" required />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" minLength={10} required />
          </label>
          <button className="primary">Change password</button>
        </form>
      </div>
    </main>
  );
}

export function WorkspaceNotFound() {
  return (
    <main className="app-page">
      <div className="empty-state">
        <Settings />
        <h1>Page not found</h1>
        <p>Choose a module from the workspace navigation.</p>
      </div>
    </main>
  );
}

export function LeadsPage() {
  return (
    <main className="app-page">
      <span className="kicker">CRM</span>
      <h1>Leads</h1>
      <div className="empty-state">
        <Users />
        <h2>Lead workflow</h2>
        <p>
          Lead capture and conversion remains available as the extended CRM
          workflow.
        </p>
      </div>
    </main>
  );
}
