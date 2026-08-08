import { BarChart3, FileText, Package, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { removeImageBackground } from "../../lib/imageUtils.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  agreementDocument,
  invoiceDocument,
  quotationDocument,
} from "../documents/templates.js";

const text = (v) => (v == null ? "—" : String(v));
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const parseQty = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = String(val).match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? parseFloat(match[0]) : 0;
};

const formObject = (form) => {
  const result = {};
  new FormData(form).forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const printRecord = async (title, row, user) => {
  const isQuotation = String(title || "").toLowerCase().includes("quotation");
  const isAgreement = String(title || "").toLowerCase().includes("agreement");

  if (isAgreement && user?.roles?.includes("customer") && (row.locked || row.payment_status !== "Paid")) {
    return toast.error("PayU Payment required before viewing/downloading agreement.");
  }
  let recordData = row;
  if (isAgreement) {
    try {
      const docRes = await api(`/agreements/${row.id || row._id}/document`);
      recordData = docRes;
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Document fetch failed");
    }
  }

  try {
    const html = isQuotation
      ? quotationDocument(recordData)
      : isAgreement
        ? agreementDocument(recordData)
        : invoiceDocument(recordData);

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return toast.error("Allow pop-ups to print PDF");
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } catch (err) {
    console.error("PDF document generation error:", err);
    toast.error("Failed to generate document HTML");
  }
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
  const [editingRow, setEditingRow] = useState(null);
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

          // Fetch next auto-generated number
          if (title === "Quotations") {
            const firstBrand = qItems[0]?.brand || "LivFast";
            const numRes = await api(`/next-number/QOT?brand=${encodeURIComponent(firstBrand)}`);
            if (numRes?.nextNumber) setQNumber(numRes.nextNumber);
          } else if (title === "Invoices") {
            const firstBrand = iItems[0]?.brand || "A1 Solution";
            const numRes = await api(`/next-number/INV?brand=${encodeURIComponent(firstBrand)}`);
            if (numRes?.nextNumber) setINumber(numRes.nextNumber);
          } else if (title === "Agreements") {
            const numRes = await api(`/next-number/AGR?brand=LivFast`);
            if (numRes?.nextNumber) setANumber(numRes.nextNumber);
          }
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
  const [qNumber, setQNumber] = useState("");
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
  const [iNumber, setINumber] = useState("");
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
  const [aNumber, setANumber] = useState("");
  const [aDate, setADate] = useState("2026-04-25");
  const [aCustName, setACustName] = useState("ARJUN CHAUDHARY");
  const [aCustMobile, setACustMobile] = useState("9955964771");
  const [aCustEmail, setACustEmail] = useState("");
  const [aAddress, setAAddress] = useState("NEAR KABIR MATH GOVINDPUR BAZIDPUR VAISHALI BIHAR 844503");
  const [aQuotationNumber, setAQuotationNumber] = useState("AI-QUO-0101");
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

  const handleEdit = (row) => {
    setEditingRow(row);
    if (title === "Quotations") {
      setQNumber(row.quotation_number || row.quotationNumber || row.number || "");
      setQDate(row.quotation_date || row.quotationDate || "2026-04-25");
      setQCapacity(String(row.capacity_kw || row.capacityKw || "3"));
      setQType(row.quotation_type || row.quotationType || "ON-GRID SOLAR POWER SYSTEM");

      const custName = row.customer_name || row.customerName || row.customers?.name || "";
      const custMobile = row.customer_mobile || row.customerMobile || row.customers?.mobile || "";
      let custEmail = row.customer_email || row.customerEmail || row.customers?.email || "";
      let custGst = row.customer_gst || row.customerGst || row.customers?.gst_number || row.customers?.gstNumber || row.customer_gstin || "";
      const custAddress = row.consumer_address || row.consumerAddress || row.installation_address || row.customers?.address || "";

      const foundCust = availableCustomers.find(
        c => (c.name && custName && c.name.trim().toLowerCase() === custName.trim().toLowerCase()) ||
             (c.mobile && custMobile && c.mobile.trim() === custMobile.trim()) ||
             (c.id && row.customer_id && String(c.id) === String(row.customer_id))
      );
      if (foundCust) {
        if (!custEmail) custEmail = foundCust.email || "";
        if (!custGst) custGst = foundCust.gst_number || foundCust.gstNumber || foundCust.gstin || "";
      }

      const matchInList = availableCustomers.find(c => c.name?.trim().toLowerCase() === custName.trim().toLowerCase());
      if (custName && !matchInList) {
        setIsCustomCustomer(true);
      } else {
        setIsCustomCustomer(false);
      }

      setQCustName(matchInList ? matchInList.name : custName);
      setQCustMobile(custMobile || (matchInList?.mobile || ""));
      setQCustEmail(custEmail || (matchInList?.email || ""));
      setQCustGst(custGst || (matchInList?.gst_number || ""));
      setQAddress(custAddress || (matchInList?.address || ""));

      setQValid(row.valid_until || row.validUntil || "2026-05-25");
      setQCustomerSignature(row.customer_signature_url || row.customerSignatureUrl || null);

      const rawItems = Array.isArray(row.quotation_items) && row.quotation_items.length > 0
        ? row.quotation_items
        : Array.isArray(row.items) && row.items.length > 0
          ? row.items
          : [];
      if (rawItems.length > 0) {
        setQItems(rawItems.map(item => {
          const pName = item.product_name ?? item.productName ?? item.products?.name ?? item.description ?? "Solar Product";
          const matchedProd = availableProducts.find(p => p.name?.toLowerCase() === pName?.toLowerCase() || p.id === item.product_id);
          return {
            productId: matchedProd?.id || item.product_id || item.productId || (pName ? "custom" : ""),
            productName: pName,
            description: item.description ?? "",
            brand: item.brand ?? item.brand_model ?? item.products?.brand ?? item.products?.model ?? "LivFast",
            quantity: String(item.quantity ?? "1"),
            unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0)
          };
        }));
      }
    } else if (title === "Invoices") {
      setINumber(row.invoice_number || row.invoiceNumber || row.number || "");
      setITitle(row.title || "SOLAR POWER SYSTEM");

      const custName = row.customer_name || row.customerName || row.customers?.name || "";
      const custMobile = row.customer_mobile || row.customerMobile || row.customers?.mobile || "";
      let custEmail = row.customer_email || row.customerEmail || row.customers?.email || "";
      let custGst = row.customer_gst || row.customerGst || row.customers?.gst_number || row.customers?.gstNumber || row.customer_gstin || "";
      const custAddress = row.consumer_address || row.consumerAddress || row.installation_address || row.customers?.address || "";

      const foundCust = availableCustomers.find(
        c => (c.name && custName && c.name.trim().toLowerCase() === custName.trim().toLowerCase()) ||
             (c.mobile && custMobile && c.mobile.trim() === custMobile.trim()) ||
             (c.id && row.customer_id && String(c.id) === String(row.customer_id))
      );
      if (foundCust) {
        if (!custEmail) custEmail = foundCust.email || "";
        if (!custGst) custGst = foundCust.gst_number || foundCust.gstNumber || foundCust.gstin || "";
      }

      const matchInList = availableCustomers.find(c => c.name?.trim().toLowerCase() === custName.trim().toLowerCase());
      if (custName && !matchInList) {
        setIsCustomCustomer(true);
      } else {
        setIsCustomCustomer(false);
      }

      setICustName(matchInList ? matchInList.name : custName);
      setICustMobile(custMobile || (matchInList?.mobile || ""));
      setICustEmail(custEmail || (matchInList?.email || ""));
      setICustGst(custGst || (matchInList?.gst_number || ""));
      setIAddress(custAddress || (matchInList?.address || ""));

      setIDate(row.invoice_date || row.invoiceDate || "");
      setIDueDate(row.due_date || row.dueDate || "");
      setIPaidAmount(String(row.paid_amount ?? row.paidAmount ?? 0));
      setIStatus(row.status || "Draft");

      const rawItems = Array.isArray(row.invoice_items) && row.invoice_items.length > 0
        ? row.invoice_items
        : Array.isArray(row.items) && row.items.length > 0
          ? row.items
          : [];
      if (rawItems.length > 0) {
        setIItems(rawItems.map(item => {
          const pName = item.product_name ?? item.productName ?? item.products?.name ?? item.description ?? "Solar Product";
          const matchedProd = availableProducts.find(p => p.name?.toLowerCase() === pName?.toLowerCase() || p.id === item.product_id);
          return {
            productId: matchedProd?.id || item.product_id || item.productId || (pName ? "custom" : ""),
            productName: pName,
            description: item.description ?? "",
            brand: item.brand ?? item.brand_model ?? item.products?.brand ?? item.products?.model ?? "LivFast",
            quantity: String(item.quantity ?? "1"),
            unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0)
          };
        }));
      }
    } else if (title === "Agreements") {
      setANumber(row.agreement_number || row.agreementNumber || row.number || "");
      setADate(row.agreement_date || row.agreementDate || "");

      const custName = row.customer_name || row.customerName || row.customers?.name || "";
      const custMobile = row.customer_mobile || row.customerMobile || row.customers?.mobile || "";
      let custEmail = row.customer_email || row.customerEmail || row.customers?.email || "";
      const custAddress = row.consumer_address || row.consumerAddress || row.installation_address || row.customers?.address || "";

      const foundCust = availableCustomers.find(
        c => (c.name && custName && c.name.trim().toLowerCase() === custName.trim().toLowerCase()) ||
             (c.mobile && custMobile && c.mobile.trim() === custMobile.trim()) ||
             (c.id && row.customer_id && String(c.id) === String(row.customer_id))
      );
      if (foundCust) {
        if (!custEmail) custEmail = foundCust.email || "";
      }

      const matchInList = availableCustomers.find(c => c.name?.trim().toLowerCase() === custName.trim().toLowerCase());
      if (custName && !matchInList) {
        setIsCustomCustomer(true);
      } else {
        setIsCustomCustomer(false);
      }

      setACustName(matchInList ? matchInList.name : custName);
      setACustMobile(custMobile || (matchInList?.mobile || ""));
      setACustEmail(custEmail || (matchInList?.email || ""));
      setAAddress(custAddress || (matchInList?.address || ""));

      setAQuotationNumber(row.quotation_number || row.quotationNumber || "");
      setACapacity(String(row.capacity_kw || row.capacityKw || "3"));
      setAAmount(String(row.payment_amount ?? row.paymentAmount ?? 0));
      setATerms(row.terms_of_payment || row.termsOfPayment || "");
      setACustomerSignature(row.customer_signature_url || row.customerSignatureUrl || null);
    }
    setOpen(true);
  };

  const canCreate =
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("admin") ||
    user?.permissions?.includes(permission);

  const canDelete = Boolean(
    deletePermission &&
    (user?.roles?.includes("super_admin") ||
      user?.roles?.includes("admin") ||
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
      const subtotal = qItems.reduce((sum, item) => sum + (parseQty(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
      const selCust = availableCustomers.find(c => c.name === qCustName);
      body = {
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
        tax: 0,
        subtotal,
        discount: 0,
        grandTotal: subtotal,
        status: "Draft",
        customerSignatureUrl: qCustomerSignature,
        customerId: selCust ? (selCust.id || selCust._id) : null,
      };
    } else if (title === "Invoices") {
      const subtotal = iItems.reduce((sum, item) => sum + (parseQty(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
      const selCust = availableCustomers.find(c => c.name === iCustName);
      body = {
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
        tax: 0,
        subtotal,
        total: subtotal,
        customerId: selCust ? (selCust.id || selCust._id) : null,
      };
    } else if (title === "Agreements") {
      const selCust = availableCustomers.find(c => c.name === aCustName);
      body = {
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
        customerSignatureUrl: aCustomerSignature,
        customerId: selCust ? (selCust.id || selCust._id) : null,
      };
    } else {
      body = formObject(e.currentTarget);
    }

    if (user?.company_name || user?.companyName) {
      body.companyName = user.company_name || user.companyName;
      body.companyAddress = user.company_address || user.companyAddress;
      body.companyLogoUrl = user.company_logo_url || user.companyLogoUrl;
      body.companySignatureUrl = user.company_signature_url || user.companySignatureUrl;
      body.bankDetails = user.bank_details || user.bankDetails;
    }

    try {
      if (editingRow) {
        const targetId = (editingRow.id && String(editingRow.id).length === 24)
          ? editingRow.id
          : (editingRow._id && String(editingRow._id).length === 24)
            ? editingRow._id
            : (editingRow.id || editingRow._id || editingRow.quotation_number || editingRow.invoice_number || editingRow.agreement_number);

        await api(`${path}/${targetId}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success(`${title.slice(0, -1)} updated successfully`);
      } else {
        await api(path, { method: "POST", body: JSON.stringify(body) });
        toast.success(`${title.slice(0, -1)} created`);
      }
      setOpen(false);
      setEditingRow(null);
      await load();
    } catch (x) {
      toast.error(x instanceof Error ? x.message : `Unable to ${editingRow ? "update" : "create"}`);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete this ${title.toLowerCase().slice(0, -1)}?`)) return;
    const targetId = (row.id && String(row.id).length === 24)
      ? row.id
      : (row._id && String(row._id).length === 24)
        ? row._id
        : (row.id || row._id || row.agreement_number || row.invoice_number || row.quotation_number || row.customer_number);

    // Optimistically update UI table state immediately
    setRows((prev) =>
      prev.filter(
        (r) =>
          r.id !== row.id &&
          r._id !== row._id &&
          r.id !== targetId &&
          r._id !== targetId &&
          (row.agreement_number ? r.agreement_number !== row.agreement_number : true) &&
          (row.invoice_number ? r.invoice_number !== row.invoice_number : true) &&
          (row.quotation_number ? r.quotation_number !== row.quotation_number : true) &&
          (r.agreement_number ? r.agreement_number !== targetId : true) &&
          (r.invoice_number ? r.invoice_number !== targetId : true) &&
          (r.quotation_number ? r.quotation_number !== targetId : true)
      )
    );

    // Manually purge matching record and duplicate custom numbers from browser cache
    try {
      const rawPath = path.split("?")[0] ?? "";
      const entity = rawPath.split("/").filter(Boolean)[0];
      if (entity) {
        const storageKey = `a1_db_cache_${entity}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const list = JSON.parse(stored);
          const updated = list.filter(
            (r) =>
              r.id !== row.id &&
              r._id !== row._id &&
              r.id !== targetId &&
              r._id !== targetId &&
              (row.agreement_number ? r.agreement_number !== row.agreement_number : true) &&
              (row.invoice_number ? r.invoice_number !== row.invoice_number : true) &&
              (row.quotation_number ? r.quotation_number !== row.quotation_number : true) &&
              !String(r.invoice_number || "").includes("FDBAC") &&
              !String(r.title || "").includes("MOUNTING STRUCTURE")
          );
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
      }
    } catch {}

    try {
      await api(`${path}/${targetId}`, { method: "DELETE" });
      toast.success("Deleted successfully");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      await load();
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
          <button className="primary" onClick={() => { setEditingRow(null); setOpen(true); }}>
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
              <h2 style={{ margin: "0 0 20px", fontSize: "20px" }}>{editingRow ? "Edit Quotation" : "Create Premium Quotation"}</h2>
              <div className="create-form-grid">
                <label>Quote Number<input value={qNumber} readOnly style={{ background: "#f0f4fb", cursor: "default" }} /></label>
                <label>Quotation Date<input type="date" value={qDate} onChange={e => setQDate(e.target.value)} required /></label>
                <label>System Capacity (kW)<input type="number" value={qCapacity} onChange={e => setQCapacity(e.target.value)} required /></label>
                <label>Quotation Type<input value={qType} onChange={e => setQType(e.target.value)} required /></label>
                <label>Customer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={qCustName} onChange={e => setQCustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={qCustName || ""}
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
                            setQCustGst(customer.gst_number || customer.gstNumber || "");
                            if (customer.address) setQAddress(customer.address);
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Customer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      {qCustName && !availableCustomers.some(c => c.name === qCustName) && (
                        <option value={qCustName}>{qCustName}</option>
                      )}
                      <option value="custom">+ Add Custom Name</option>
                    </select>
                  )}
                </label>
                <label>Customer Mobile<input value={qCustMobile} onChange={e => setQCustMobile(e.target.value)} required /></label>
                <label>Customer Email<input type="email" value={qCustEmail} onChange={e => setQCustEmail(e.target.value)} /></label>
                <label>Customer GSTIN<input value={qCustGst} onChange={e => setQCustGst(e.target.value)} /></label>
                <label className="span-2">Installation Address<textarea value={qAddress} onChange={e => setQAddress(e.target.value)} rows={2} required /></label>
                <label>Valid Until<input type="date" value={qValid} onChange={e => setQValid(e.target.value)} required /></label>
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
                      const lineAmt = (parseQty(item.quantity) || 0) * (Number(item.unitPrice) || 0);
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
                const total = qItems.reduce((s, it) => s + (parseQty(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
                return (
                  <div className="live-total-box">
                    <div className="live-total-row grand" style={{ flexDirection: "column", alignItems: "stretch", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Total Amount</span>
                        <span>₹{total.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "11px", fontWeight: "normal", opacity: 0.85 }}>(Including GST)</div>
                    </div>
                  </div>
                );
              })()}

              <div className="row-actions" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", marginTop: "16px" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="primary">{editingRow ? "Save Changes" : "Create Quotation"}</button>
              </div>
            </form>
          ) : title === "Invoices" ? (
            <form className="card modal-form" style={{ maxWidth: "920px", width: "95%", maxHeight: "92vh", overflowY: "auto", padding: "28px" }} onSubmit={submit}>
              <h2 style={{ margin: "0 0 20px", fontSize: "20px" }}>{editingRow ? "Edit Invoice" : "Create Invoice"}</h2>
              <div className="create-form-grid">
                <label>Invoice Number<input value={iNumber} readOnly style={{ background: "#f0f4fb", cursor: "default" }} /></label>
                <label>Invoice Title<input value={iTitle} onChange={e => setITitle(e.target.value)} required /></label>
                <label>Invoice Date<input type="date" value={iDate} onChange={e => setIDate(e.target.value)} required /></label>
                <label>Due Date<input type="date" value={iDueDate} onChange={e => setIDueDate(e.target.value)} required /></label>
                <label>Customer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={iCustName} onChange={e => setICustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={iCustName || ""}
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
                            setICustGst(customer.gst_number || customer.gstNumber || "");
                            if (customer.address) setIAddress(customer.address);
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Customer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      {iCustName && !availableCustomers.some(c => c.name === iCustName) && (
                        <option value={iCustName}>{iCustName}</option>
                      )}
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
                      const lineAmt = (parseQty(item.quantity) || 0) * (Number(item.unitPrice) || 0);
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
                const total = iItems.reduce((s, it) => s + (parseQty(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
                const paid = Number(iPaidAmount) || 0;
                const balance = Math.max(0, total - paid);
                return (
                  <div className="live-total-box">
                    <div className="live-total-row grand" style={{ flexDirection: "column", alignItems: "stretch", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Total Amount</span>
                        <span>₹{total.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "11px", fontWeight: "normal", opacity: 0.85 }}>(Including GST)</div>
                    </div>
                    <div className="live-total-row"><span>Paid Amount</span><span>₹{paid.toLocaleString("en-IN")}</span></div>
                    <div className="live-total-row balance"><span>Balance Due</span><span>₹{balance.toLocaleString("en-IN")}</span></div>
                  </div>
                );
              })()}

              <div className="row-actions" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", marginTop: "16px" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="primary">{editingRow ? "Save Changes" : "Create Invoice"}</button>
              </div>
            </form>
          ) : title === "Agreements" ? (
            <form className="card modal-form" style={{ maxWidth: "780px", width: "95%", maxHeight: "90vh", overflowY: "auto" }} onSubmit={submit}>
              <h2>{editingRow ? "Edit Agreement" : "Create Agreement"}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <label>Agreement Number<input value={aNumber} readOnly style={{ background: "#f0f4fb", cursor: "default" }} /></label>
                <label>Agreement Date<input type="date" value={aDate} onChange={e => setADate(e.target.value)} required /></label>
                <label>Consumer Name
                  {isCustomCustomer ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input style={{ flex: 1, minWidth: 0 }} value={aCustName} onChange={e => setACustName(e.target.value)} placeholder="Type name" required autoFocus />
                      <button type="button" onClick={() => { setIsCustomCustomer(false); }} className="secondary" style={{ padding: '0 10px' }}>×</button>
                    </div>
                  ) : (
                    <select
                      value={aCustName || ""}
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
                            if (customer.address) setAAddress(customer.address);
                          }
                        }
                      }}
                      required
                    >
                      <option value="" disabled>-- Select Consumer --</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.mobile})</option>
                      ))}
                      {aCustName && !availableCustomers.some(c => c.name === aCustName) && (
                        <option value={aCustName}>{aCustName}</option>
                      )}
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
                <button className="primary">{editingRow ? "Save Changes" : "Create Agreement"}</button>
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
                <strong>₹{Number(payuRow.payment_amount || 1).toLocaleString("en-IN")}</strong>
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
                    const payuData = await api(`/agreements/${payuRow.id}/payu-initiate`, {
                      method: "POST",
                    });

                    if (payuData && payuData.payu_url && payuData.hash) {
                      toast.success("Redirecting to PayU Payment Gateway…");
                      const form = document.createElement("form");
                      form.method = "POST";
                      form.action = payuData.payu_url;

                      const params = {
                        key: payuData.key,
                        txnid: payuData.txnid,
                        amount: payuData.amount,
                        productinfo: payuData.productinfo,
                        firstname: payuData.firstname,
                        email: payuData.email,
                        phone: payuData.phone || "9999999999",
                        surl: payuData.surl,
                        furl: payuData.furl,
                        hash: payuData.hash,
                        service_provider: "payu_paisa"
                      };

                      Object.entries(params).forEach(([k, v]) => {
                        const input = document.createElement("input");
                        input.type = "hidden";
                        input.name = k;
                        input.value = String(v);
                        form.appendChild(input);
                      });

                      document.body.appendChild(form);
                      form.submit();
                    } else {
                      throw new Error("PayU checkout initiation failed");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "PayU payment failed");
                    setPaying(false);
                  }
                }}
              >
                {paying ? "Opening PayU Gateway…" : "Pay Now via PayU 🚀"}
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
                {(printable || canDelete || canCreate) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isAgreementLocked = title === "Agreements" && user?.roles?.includes("customer") && (row.locked || row.payment_status !== "Paid");
                return (
                  <tr key={row.id}>
                    {columns.map(([key, _, fmt]) => (
                      <td key={key}>{fmt ? fmt(row[key]) : text(row[key])}</td>
                    ))}
                    {(printable || canDelete || canCreate) && (
                      <td>
                        <div className="row-actions">
                          {canCreate && (title === "Quotations" || title === "Invoices" || title === "Agreements") && (
                            <button
                              className="secondary"
                              style={{ background: "#2563eb", borderColor: "#1d4ed8", color: "#fff", fontWeight: 600, padding: "5px 10px", fontSize: "12px" }}
                              onClick={() => handleEdit(row)}
                            >
                              Edit
                            </button>
                          )}
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
                              <button
                                className="secondary"
                                onClick={() => void printRecord(title.slice(0, -1), row, user)}
                              >
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
  const [companyName, setCompanyName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [counters, setCounters] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Generate prefix preview from company name (client-side preview)
  const previewPrefix = (name) => {
    if (!name || typeof name !== "string") return "AI";
    const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return "AI";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api("/company-settings");
        if (res?.company_name) {
          setCompanyName(res.company_name);
          setPrefix(res.prefix);
          setCounters(res.counters || {});
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api("/company-settings", {
        method: "PUT",
        body: JSON.stringify({ companyName }),
      });
      if (res?.prefix) setPrefix(res.prefix);
      toast.success("Company settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const typeLabels = {
    QOT: "Quotation",
    QUO: "Quotation",
    INV: "Invoice",
    AGR: "Agreement",
    CUS: "Customer",
    PRJ: "Project",
    TKT: "Ticket",
    CON: "Contract",
    EST: "Estimate",
    SKU: "Product SKU",
  };

  return (
    <main className="app-page">
      <span className="kicker">SYSTEM</span>
      <h1>Company Settings</h1>
      <div className="detail-grid">
        <form className="card operational-form" onSubmit={handleSave}>
          <h2>Company Information</h2>
          <label>
            Company Name
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              required
              disabled={loading}
            />
          </label>
          <label>
            Auto-Generated Prefix
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                value={companyName ? previewPrefix(companyName) : prefix}
                readOnly
                style={{ background: "#f0f4fb", cursor: "default", fontWeight: 700, fontSize: "16px", letterSpacing: "2px", maxWidth: "100px" }}
              />
              <span style={{ fontSize: "13px", color: "#6b7280" }}>
                Preview: {previewPrefix(companyName)}-INV-0101
              </span>
            </div>
          </label>
          <button className="primary" disabled={saving || loading}>
            {saving ? "Saving..." : "Save Company Settings"}
          </button>
        </form>

        <div className="card">
          <h2>Sequence Counters</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "12px" }}>Current sequence numbers for each document type. Next record will use the value shown + 1.</p>
          {loading ? (
            <p>Loading...</p>
          ) : Object.keys(counters).length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No sequences generated yet. Create your first record to initialize.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "11px", textTransform: "uppercase", color: "#6b7280" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "11px", textTransform: "uppercase", color: "#6b7280" }}>Current #</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "11px", textTransform: "uppercase", color: "#6b7280" }}>Next Will Be</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(counters).map(([type, seq]) => (
                  <tr key={type} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{typeLabels[type] || type}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{prefix}-{type}-{String(seq).padStart(4, "0")}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#059669" }}>{prefix}-{type}-{String(Math.max(seq + 1, 101)).padStart(4, "0")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [companyLogoUrl, setCompanyLogoUrl] = useState(user?.company_logo_url || user?.companyLogoUrl || null);
  const [companySignatureUrl, setCompanySignatureUrl] = useState(user?.company_signature_url || user?.companySignatureUrl || null);

  useEffect(() => {
    if (user?.company_logo_url || user?.companyLogoUrl) {
      setCompanyLogoUrl(user.company_logo_url || user.companyLogoUrl);
    }
    if (user?.company_signature_url || user?.companySignatureUrl) {
      setCompanySignatureUrl(user.company_signature_url || user.companySignatureUrl);
    }
  }, [user]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || "");
      const clean = await removeImageBackground(raw);
      setCompanyLogoUrl(clean);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || "");
      const clean = await removeImageBackground(raw);
      setCompanySignatureUrl(clean);
    };
    reader.readAsDataURL(file);
  };

  const profile = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const accountHolder = String(form.get("accountHolder") || "").trim();
    const bankName = String(form.get("bankName") || "").trim();
    const branch = String(form.get("bankBranch") || "").trim();
    const accountNo = String(form.get("accountNo") || "").trim();
    const ifscCode = String(form.get("ifscCode") || "").trim();

    const bankDetails = (accountHolder || bankName || accountNo) ? {
      accountHolder: accountHolder || "A1 SOLAR SOLUTION",
      bankName: bankName || "PUNJAB NATIONAL BANK",
      branch: branch || "TAJPUR",
      accountNo: accountNo || "9335002100003167",
      ifscCode: ifscCode || "PUNB0933500",
    } : (user?.bank_details || user?.bankDetails || null);

    try {
      await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone") || null,
          companyName: form.get("companyName") || null,
          companyAddress: form.get("companyAddress") || null,
          companyGstin: form.get("companyGstin") || null,
          companyLogoUrl: companyLogoUrl,
          companySignatureUrl: companySignatureUrl,
          bankDetails: bankDetails,
        }),
      });
      toast.success("Profile, Branding & Bank details updated successfully!");
      if (refreshProfile) await refreshProfile();
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

  const bank = user?.bank_details || user?.bankDetails || {};

  return (
    <main className="app-page">
      <span className="kicker">MY ACCOUNT</span>
      <h1>Profile & security</h1>
      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "24px" }}>
        <form className="card operational-form" onSubmit={profile}>
          <h2>Admin Profile & Company Setup</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label>
              Full name
              <input name="fullName" defaultValue={user?.fullName || user?.full_name} required />
            </label>
            <label>
              Mobile / Phone
              <input name="phone" defaultValue={user?.phone} />
            </label>
          </div>

          <h3 style={{ margin: "20px 0 10px", fontSize: "15px", borderBottom: "1px solid #eee", paddingBottom: "6px" }}>
            🏢 Admin Company &amp; Branding Setup
          </h3>
          <p style={{ color: "#666", fontSize: "12px", margin: "-6px 0 14px" }}>
            Set custom company logo, stamp signature, address and bank details for your admin profile.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label>
              Company Name
              <input name="companyName" defaultValue={user?.company_name || user?.companyName || "A1 SOLAR SOLUTION"} placeholder="Company Name" />
            </label>
            <label>
              Company GSTIN Number
              <input name="companyGstin" defaultValue={user?.company_gstin || user?.companyGstin || "10EFTPA0258C1Z1"} placeholder="Company GSTIN" />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "14px" }}>
            <span>Company Registered Address</span>
            <textarea
              name="companyAddress"
              defaultValue={user?.company_address || user?.companyAddress || "VISHNUPUR KAIJU PATEHPUR VAISHALI BIHAR"}
              rows={3}
              placeholder="Enter complete company registered address"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span>Company Logo</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
              {companyLogoUrl ? (
                <div style={{ marginTop: "6px", padding: "8px", background: "#0a2e36", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "12px" }}>
                  <img src={companyLogoUrl} alt="Logo Preview" style={{ height: "40px", maxWidth: "140px", objectFit: "contain" }} />
                  <button type="button" onClick={() => setCompanyLogoUrl(null)} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Remove Logo</button>
                </div>
              ) : (
                <small style={{ color: "#666" }}>Upload PNG/JPG logo</small>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span>Stamp / Proprietor Signature</span>
              <input type="file" accept="image/*" onChange={handleSignatureUpload} />
              {companySignatureUrl ? (
                <div style={{ marginTop: "6px", padding: "8px", background: "#fff", border: "1px solid #ddd", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "12px" }}>
                  <img src={companySignatureUrl} alt="Signature Preview" style={{ height: "40px", maxWidth: "140px", objectFit: "contain" }} />
                  <button type="button" onClick={() => setCompanySignatureUrl(null)} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Remove Stamp</button>
                </div>
              ) : (
                <small style={{ color: "#666" }}>Upload Stamp / Signature image</small>
              )}
            </label>
          </div>

          <h3 style={{ margin: "24px 0 10px", fontSize: "15px", borderBottom: "1px solid #eee", paddingBottom: "6px" }}>
            💳 Payment Details (Bank Account Info)
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <label>
              Account Holder
              <input name="accountHolder" defaultValue={bank.accountHolder || "A1 SOLAR SOLUTION"} placeholder="Account Holder Name" />
            </label>
            <label>
              Bank Name
              <input name="bankName" defaultValue={bank.bankName || "PUNJAB NATIONAL BANK"} placeholder="Bank Name" />
            </label>
            <label>
              Branch
              <input name="bankBranch" defaultValue={bank.branch || "TAJPUR"} placeholder="Branch Name" />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "10px" }}>
            <label>
              Account Number
              <input name="accountNo" defaultValue={bank.accountNo || "9335002100003167"} placeholder="Account Number" />
            </label>
            <label>
              IFSC Code
              <input name="ifscCode" defaultValue={bank.ifscCode || "PUNB0933500"} placeholder="IFSC Code" />
            </label>
          </div>

          <button className="primary" style={{ marginTop: "24px" }}>Save Profile, Branding &amp; Bank Details</button>
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
