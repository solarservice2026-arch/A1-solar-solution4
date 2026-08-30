import { BarChart3, FileText, Package, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { removeImageBackground, compressLogoOrSignature, compressImage } from "../../lib/imageUtils.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  agreementDocument,
  amountWords,
  invoiceDocument,
  quotationDocument,
} from "../documents/templates.js";

const formatDateDDMMYYYY = (val) => {
  if (val == null || val === "") return "—";
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
    }
    return str;
  }
  const dObj = new Date(str);
  if (!isNaN(dObj.getTime())) {
    const day = String(dObj.getDate()).padStart(2, "0");
    const month = String(dObj.getMonth() + 1).padStart(2, "0");
    const year = dObj.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return str;
};

const text = (v) => {
  if (v == null || v === "") return "—";
  const str = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return formatDateDDMMYYYY(str);
  }
  return str;
};
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

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const printRecord = async (title, row, user) => {
  const isQuotation = String(title || "").toLowerCase().includes("quotation");
  const isAgreement = String(title || "").toLowerCase().includes("agreement");
  const isInvoice = String(title || "").toLowerCase().includes("invoice");

  if (isAgreement && user?.roles?.includes("customer") && (row.locked || row.payment_status !== "Paid")) {
    return toast.error("PayU Payment required before viewing/downloading agreement.");
  }

  let recordData = { ...row };
  const targetId = row.id || row._id;

  if (targetId && String(targetId).length === 24) {
    try {
      if (isAgreement) {
        const docRes = await api(`/agreements/${targetId}/document`);
        if (docRes && (docRes.id || docRes._id)) recordData = docRes;
      } else if (isQuotation) {
        const docRes = await api(`/quotations/${targetId}`);
        if (docRes && (docRes.id || docRes._id)) recordData = docRes;
      } else if (isInvoice) {
        const docRes = await api(`/invoices/${targetId}`);
        if (docRes && (docRes.id || docRes._id)) recordData = docRes;
      }
    } catch {}
  }

  // Ensure current company logo and details are attached if missing on row
  if (user && (!recordData.company_logo_url && !recordData.companyLogoUrl)) {
    recordData.company_logo_url = user.company_logo_url || user.companyLogoUrl;
    recordData.company_name = recordData.company_name || user.company_name || user.companyName;
    recordData.company_address = recordData.company_address || user.company_address || user.companyAddress;
    recordData.company_gstin = recordData.company_gstin || user.company_gstin || user.companyGstin;
    recordData.company_signature_url = recordData.company_signature_url || user.company_signature_url || user.companySignatureUrl;
    recordData.bank_details = recordData.bank_details || user.bank_details || user.bankDetails;
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
  const isCustomer = Boolean(user?.roles?.includes("customer"));
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [payuRow, setPayuRow] = useState(null);
  const [paying, setPaying] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCustomers, setAvailableCustomers] = useState([]);

  // ─── CUSTOM FORMS STATES ───
  // Quotation States
  const [qNumber, setQNumber] = useState("");
  const [qDate, setQDate] = useState(getTodayDateStr());
  const [qCapacity, setQCapacity] = useState("3");
  const [qType, setQType] = useState("ON-GRID SOLAR POWER SYSTEM");
  const [qCustName, setQCustName] = useState("");
  const [qCustMobile, setQCustMobile] = useState("");
  const [qCustEmail, setQCustEmail] = useState("");
  const [qAddress, setQAddress] = useState("");
  const [qItems, setQItems] = useState([
    { productName: "Solar Panel", description: "Mono-Halfcut 545 Watt DCR", brand: "LivFast", quantity: "6", unitPrice: 22000 },
    { productName: "Inverter", description: "ON GRID 3 KVA", brand: "LivFast", quantity: "1", unitPrice: 48000 },
    { productName: "Structure", description: "Ms/GI", brand: "Branded", quantity: "3KW", unitPrice: 14000 },
    { productName: "ACDB & DCDB Earthing La Ac Wire Dc Wire", description: "For 3KW", brand: "Branded", quantity: "3/KW", unitPrice: 9000 }
  ]);
  const [qCustomerSignature, setQCustomerSignature] = useState(null);

  const handleQSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = String(ev.target?.result || "");
        const compressed = await compressLogoOrSignature(raw);
        setQCustomerSignature(compressed);
      };
      reader.readAsDataURL(file);
    } else {
      setQCustomerSignature(null);
    }
  };

  // Invoice States
  const [iNumber, setINumber] = useState("");
  const [iTitle, setITitle] = useState("FOR 5KW MOUNTING STRUCTURE — OFF-GRID");
  const [iCustName, setICustName] = useState("");
  const [iCustMobile, setICustMobile] = useState("");
  const [iAddress, setIAddress] = useState("");
  const [iDate, setIDate] = useState(getTodayDateStr());
  const [iPaidAmount, setIPaidAmount] = useState("0");
  const [iStatus, setIStatus] = useState("Unpaid");
  const [iItems, setIItems] = useState([
    { productName: "Solar Panel", description: "Mono-Halfcut 545 Watt DCR", brand: "LivFast", quantity: "6", unitPrice: 22000, cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 },
    { productName: "Inverter", description: "ON GRID 3 KVA", brand: "LivFast", quantity: "1", unitPrice: 48000, cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 },
    { productName: "Structure", description: "Ms/GI", brand: "Branded", quantity: "3KW", unitPrice: 14000, cgstRate: 9, sgstRate: 9, igstRate: 0 },
    { productName: "ACDB & DCDB Earthing La Ac Wire Dc Wire", description: "For 3KW", brand: "Branded", quantity: "3/KW", unitPrice: 9000, cgstRate: 9, sgstRate: 9, igstRate: 0 }
  ]);

  // Agreement States
  const [aNumber, setANumber] = useState("");
  const [aDate, setADate] = useState(getTodayDateStr());
  const [aCustName, setACustName] = useState("");
  const [aCustMobile, setACustMobile] = useState("");
  const [aAddress, setAAddress] = useState("");
  const [aTerms, setATerms] = useState("70% advance payment shall be made at the time of order confirmation. Remaining 30% payment shall be made immediately after installation completion. All payments must be made through Bank Transfer / UPI / Cheque only. Any delay in payment may result in project delay or suspension of service.");
  const [aCustomerSignature, setACustomerSignature] = useState(null);

  useEffect(() => {
    if (title === "Quotations" || title === "Invoices" || title === "Agreements") {
      const loadMasterData = async () => {
        try {
          if (title === "Quotations" || title === "Invoices") {
            const res = await api("/products");
            if (Array.isArray(res)) setAvailableProducts(res);
          }
          const custRes = await api("/customers");
          if (Array.isArray(custRes)) setAvailableCustomers(custRes);
        } catch (e) {}
      };
      void loadMasterData();
    }
  }, [title]);

  useEffect(() => {
    if (open && (title === "Quotations" || title === "Invoices" || title === "Agreements")) {
      const fetchData = async () => {
        try {
          if (!editingRow) {
            // Fetch next auto-generated number for new creation
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
          }
        } catch (e) {
          console.error("Failed to load document sequence number", e);
        }
      };
      void fetchData();
    }

  }, [open, title, editingRow]);

  useEffect(() => {
    if (open && !editingRow) {
      if (user?.roles?.includes("customer")) {
        const cName = user?.fullName || user?.full_name || user?.name || user?.company_name || "Customer";
        const cEmail = user?.email || "";
        const cMobile = user?.mobile || user?.phone || "";
        const cAddress = user?.address || user?.installation_address || user?.consumer_address || "";

        if (title === "Quotations") {
          setQCustName(cName);
          setQCustEmail(cEmail);
          setQCustMobile(cMobile);
          setQAddress(cAddress);
        } else if (title === "Invoices") {
          setICustName(cName);
          setICustMobile(cMobile);
          setIAddress(cAddress);
        } else if (title === "Agreements") {
          setACustName(cName);
          setACustMobile(cMobile);
          setAAddress(cAddress);
        }
      }
    }
  }, [open, editingRow, user, title]);

  useEffect(() => {
    if (open && editingRow && availableCustomers.length > 0) {
      const custName = editingRow.customer_name || editingRow.customerName || editingRow.customers?.name || "";
      const custMobile = editingRow.customer_mobile || editingRow.customerMobile || editingRow.customers?.mobile || "";
      const found = availableCustomers.find(
        c => (c.name && custName && c.name.trim().toLowerCase() === custName.trim().toLowerCase()) ||
             (c.mobile && custMobile && c.mobile.trim() === custMobile.trim()) ||
             (c.id && editingRow.customer_id && String(c.id) === String(editingRow.customer_id))
      );
      if (found) {
        const emailVal = editingRow.customer_email || editingRow.customerEmail || editingRow.customers?.email || found.email || "";
        const mobileVal = custMobile || found.mobile || "";
        const addressVal = editingRow.consumer_address || editingRow.consumerAddress || editingRow.installation_address || editingRow.customers?.address || found.address || "";

        if (title === "Quotations") {
          setQCustEmail(emailVal);
          setQCustMobile(mobileVal);
          setQAddress(addressVal);
        } else if (title === "Invoices") {
          setICustMobile(mobileVal);
          setIAddress(addressVal);
        } else if (title === "Agreements") {
          setACustMobile(mobileVal);
          setAAddress(addressVal);
        }
      }
    }
  }, [open, editingRow, availableCustomers, title]);

  useEffect(() => {
    if (open && !editingRow) {
      const today = getTodayDateStr();
      setQDate(today);
      setIDate(today);
      setADate(today);
      if (isCustomer) {
        const uName = user?.fullName || user?.full_name || user?.name || user?.company_name || "Customer";
        setQCustName(uName);
        setICustName(uName);
        setACustName(uName);
      }
    }
  }, [open, editingRow, title, isCustomer, user]);

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = String(ev.target?.result || "");
        const compressed = await compressLogoOrSignature(raw);
        setACustomerSignature(compressed);
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
      setQDate(row.quotation_date || row.quotationDate || getTodayDateStr());
      setQCapacity(String(row.capacity_kw || row.capacityKw || "3"));
      setQType(row.quotation_type || row.quotationType || "ON-GRID SOLAR POWER SYSTEM");

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

      setQCustName(custName);
      setQCustMobile(custMobile || (foundCust?.mobile || ""));
      setQCustEmail(custEmail || (foundCust?.email || ""));
      setQAddress(custAddress || (foundCust?.address || ""));

      setQCustomerSignature(row.customer_signature_url || row.customerSignatureUrl || null);

      const rawItems = Array.isArray(row.quotation_items) && row.quotation_items.length > 0
        ? row.quotation_items
        : Array.isArray(row.items) && row.items.length > 0
          ? row.items
          : [];
      if (rawItems.length > 0) {
        setQItems(rawItems.map(item => {
          const pName = item.product_name ?? item.productName ?? item.products?.name ?? item.description ?? "Solar Product";
          const desc = item.description ?? "";
          let uPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
          if ((pName.toLowerCase().includes("inverter") || desc.toLowerCase().includes("inverter")) && (uPrice === 43000 || uPrice === 0)) {
            uPrice = 48000;
          }
          const matchedProd = availableProducts.find(p => p.name?.toLowerCase() === pName?.toLowerCase() || p.id === item.product_id);
          return {
            productId: matchedProd?.id || item.product_id || item.productId || (pName ? "custom" : ""),
            productName: pName,
            description: desc,
            brand: item.brand ?? item.brand_model ?? item.products?.brand ?? item.products?.model ?? "LivFast",
            quantity: String(item.quantity ?? "1"),
            unitPrice: uPrice
          };
        }));
      }
    } else if (title === "Invoices") {
      setINumber(row.invoice_number || row.invoiceNumber || row.number || "");
      setITitle(row.title || "SOLAR POWER SYSTEM");

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

      setICustName(custName);
      setICustMobile(custMobile || (foundCust?.mobile || ""));
      setIAddress(custAddress || (foundCust?.address || ""));

      setIDate(row.invoice_date || row.invoiceDate || getTodayDateStr());
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
          const desc = item.description ?? "";
          let uPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
          if ((pName.toLowerCase().includes("inverter") || desc.toLowerCase().includes("inverter")) && (uPrice === 43000 || uPrice === 0)) {
            uPrice = 48000;
          }
          const matchedProd = availableProducts.find(p => p.name?.toLowerCase() === pName?.toLowerCase() || p.id === item.product_id);
          return {
            productId: matchedProd?.id || item.product_id || item.productId || (pName ? "custom" : ""),
            productName: pName,
            description: desc,
            brand: item.brand ?? item.brand_model ?? item.products?.brand ?? item.products?.model ?? "LivFast",
            quantity: String(item.quantity ?? "1"),
            unitPrice: uPrice,
            cgstRate: Number(item.cgst_rate ?? item.cgstRate ?? 2.5),
            sgstRate: Number(item.sgst_rate ?? item.sgstRate ?? 2.5),
            igstRate: Number(item.igst_rate ?? item.igstRate ?? 0)
          };
        }));
      }
    } else if (title === "Agreements") {
      setANumber(row.agreement_number || row.agreementNumber || row.number || "");
      setADate(row.agreement_date || row.agreementDate || getTodayDateStr());

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

      setACustName(custName);
      setACustMobile(custMobile || (foundCust?.mobile || ""));
      setAAddress(custAddress || (foundCust?.address || ""));

      setATerms(row.terms_of_payment || row.termsOfPayment || "");
      setACustomerSignature(row.customer_signature_url || row.customerSignatureUrl || null);
    }
    setOpen(true);
  };

  const canCreate =
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("admin") ||
    user?.roles?.includes("customer") ||
    user?.permissions?.includes(permission);

  const canDelete = Boolean(
    deletePermission &&
    (user?.roles?.includes("super_admin") ||
      user?.roles?.includes("admin") ||
      user?.roles?.includes("customer") ||
      user?.permissions?.includes(deletePermission)),
  );

  const canEdit =
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("admin") ||
    user?.roles?.includes("customer") ||
    user?.permissions?.includes(permission);

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
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");

    if (orderId && path === "/agreements") {
      const verify = async () => {
        try {
          const vRes = await api("/agreements/cashfree-verify", {
            method: "POST",
            body: JSON.stringify({ order_id: orderId }),
          });
          if (vRes?.verified || vRes?.payment_status === "Paid") {
            toast.success("Payment verified successfully! Agreement unlocked.");
          }
        } catch {}
        void load();
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {}
      };
      void verify();
    } else {
      void load();
    }
  }, [path]);

  const submit = async (e) => {
    e.preventDefault();
    let body = {};

    if (title === "Quotations") {
      const subtotal = qItems.reduce((sum, item) => sum + (parseQty(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
      const finalCustName = qCustName || (isCustomer ? (user?.fullName || user?.full_name || user?.name || user?.company_name || "") : "");
      const selCust = availableCustomers.find(c => c.name === finalCustName);
      body = {
        quotationDate: qDate,
        capacityKw: qCapacity,
        quotationType: qType,
        customerName: finalCustName,
        customerMobile: qCustMobile,
        customerEmail: qCustEmail,
        consumerAddress: qAddress,
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
      const finalCustName = iCustName || (isCustomer ? (user?.fullName || user?.full_name || user?.name || user?.company_name || "") : "");
      const selCust = availableCustomers.find(c => c.name === finalCustName);
      body = {
        title: iTitle,
        customerName: finalCustName,
        customerMobile: iCustMobile,
        consumerAddress: iAddress,
        invoiceDate: iDate,
        paidAmount: iPaidAmount,
        status: iStatus,
        items: iItems,
        tax: 0,
        subtotal,
        total: subtotal,
        customerId: selCust ? (selCust.id || selCust._id) : null,
      };
    } else if (title === "Agreements") {
      const finalCustName = aCustName || (isCustomer ? (user?.fullName || user?.full_name || user?.name || user?.company_name || "") : "");
      const selCust = availableCustomers.find(c => c.name === finalCustName);
      body = {
        agreementDate: aDate,
        customerName: finalCustName,
        customerMobile: aCustMobile,
        consumerAddress: aAddress,
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

  const addIItem = () => setIItems([...iItems, { productName: "", description: "", brand: "", quantity: "1", unitPrice: 0, cgstRate: 2.5, sgstRate: 2.5, igstRate: 0 }]);
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
          <button className="primary" onClick={() => {
            setEditingRow(null);
            const today = getTodayDateStr();
            setQDate(today);
            setIDate(today);
            setADate(today);
            setQCustName("");
            setQCustMobile("");
            setQCustEmail("");
            setQAddress("");
            setICustName("");
            setICustMobile("");
            setIAddress("");
            setACustName("");
            setACustMobile("");
            setAAddress("");
            setQCustomerSignature(null);
            setACustomerSignature(null);
            setOpen(true);
          }}>
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
                  <input
                    value={qCustName}
                    onChange={e => setQCustName(e.target.value)}
                    placeholder="Enter Customer Name"
                    required
                  />
                </label>
                <label>Customer Mobile<input value={qCustMobile} onChange={e => setQCustMobile(e.target.value)} required /></label>
                <label>Customer Email<input type="email" value={qCustEmail} onChange={e => setQCustEmail(e.target.value)} /></label>
                <label className="span-2">Installation Address<textarea value={qAddress} onChange={e => setQAddress(e.target.value)} rows={2} required /></label>
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
                  <div style={{ background: "#2563eb", color: "#ffffff", padding: "12px 16px", borderRadius: "6px", marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px", fontWeight: 700 }}>
                      <span>Total Amount</span>
                      <span>₹{total.toLocaleString("en-IN")}/-</span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "11px", color: "#e0e7ff", marginTop: "2px" }}>(Including GST)</div>
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
                <label>Customer Name
                  <input
                    value={iCustName}
                    onChange={e => setICustName(e.target.value)}
                    placeholder="Enter Customer Name"
                    required
                  />
                </label>
                <label>Customer Mobile<input value={iCustMobile} onChange={e => setICustMobile(e.target.value)} required /></label>
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
              <div className="items-responsive-table" style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", background: "#fff" }}>
                <table style={{ width: "100%", minWidth: "1180px", fontSize: "13px", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                  <thead>
                    <tr style={{ background: "#f0f4fb" }}>
                      <th style={{ width: "35px" }}>#</th>
                      <th style={{ minWidth: "180px" }}>Product</th>
                      <th style={{ minWidth: "150px" }}>Description</th>
                      <th style={{ minWidth: "110px" }}>Brand/Model</th>
                      <th style={{ width: "85px", minWidth: "85px", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "125px", minWidth: "125px", textAlign: "right" }}>Price (₹)</th>
                      <th style={{ width: "90px", minWidth: "90px", textAlign: "center" }}>CGST%</th>
                      <th style={{ width: "90px", minWidth: "90px", textAlign: "center" }}>SGST%</th>
                      <th style={{ width: "90px", minWidth: "90px", textAlign: "center" }}>IGST%</th>
                      <th style={{ width: "120px", minWidth: "120px", textAlign: "right" }}>Taxable (₹)</th>
                      <th style={{ width: "120px", minWidth: "120px", textAlign: "right" }}>Total (₹)</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {iItems.map((item, idx) => {
                      const qtyNum = parseQty(item.quantity) || 1;
                      const priceIncl = Number(item.unitPrice || 0);
                      const lineAmt = qtyNum * priceIncl;
                      const cgstR = Number(item.cgstRate ?? 2.5);
                      const sgstR = Number(item.sgstRate ?? 2.5);
                      const igstR = Number(item.igstRate ?? 0);
                      const totalGstR = cgstR + sgstR + igstR;
                      const taxableAmt = totalGstR > 0 ? lineAmt / (1 + totalGstR / 100) : lineAmt;

                      return (
                        <tr key={idx}>
                          <td style={{ color: "#888", fontSize: "12px", verticalAlign: "top", paddingTop: "14px" }}>{idx + 1}</td>
                          <td>
                            <select
                              style={{ width: "100%", marginBottom: "5px", padding: "6px" }}
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
                                style={{ width: "100%", padding: "6px" }}
                                value={item.productName}
                                onChange={e => updateIItem(idx, "productName", e.target.value)}
                                required
                              />
                            )}
                          </td>
                          <td><input style={{ width: "100%", padding: "6px 8px" }} value={item.description} onChange={e => updateIItem(idx, "description", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", padding: "6px 8px" }} value={item.brand} onChange={e => updateIItem(idx, "brand", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center", padding: "6px 4px", minWidth: "75px" }} type="text" value={item.quantity} onChange={e => updateIItem(idx, "quantity", e.target.value)} required /></td>
                          <td><input style={{ width: "100%", textAlign: "right", padding: "6px 6px", minWidth: "110px" }} type="number" value={item.unitPrice} onChange={e => updateIItem(idx, "unitPrice", Number(e.target.value))} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center", padding: "6px 4px", minWidth: "75px" }} type="number" step="0.1" value={item.cgstRate ?? 2.5} onChange={e => updateIItem(idx, "cgstRate", Number(e.target.value))} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center", padding: "6px 4px", minWidth: "75px" }} type="number" step="0.1" value={item.sgstRate ?? 2.5} onChange={e => updateIItem(idx, "sgstRate", Number(e.target.value))} required /></td>
                          <td><input style={{ width: "100%", textAlign: "center", padding: "6px 4px", minWidth: "75px" }} type="number" step="0.1" value={item.igstRate ?? 0} onChange={e => updateIItem(idx, "igstRate", Number(e.target.value))} required /></td>
                          <td style={{ textAlign: "right", fontSize: "12px", verticalAlign: "top", paddingTop: "14px", whiteSpace: "nowrap" }}>₹{taxableAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#1a3a6b", verticalAlign: "top", paddingTop: "14px", whiteSpace: "nowrap" }}>₹{lineAmt.toLocaleString("en-IN")}</td>
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
                let totalTaxable = 0;
                let totalCgst = 0;
                let totalSgst = 0;
                let totalIgst = 0;
                let grandTotal = 0;

                iItems.forEach(it => {
                  const qty = parseQty(it.quantity) || 1;
                  const price = Number(it.unitPrice) || 0;
                  const lineTot = qty * price;
                  const cgstR = Number(it.cgstRate ?? 2.5);
                  const sgstR = Number(it.sgstRate ?? 2.5);
                  const igstR = Number(it.igstRate ?? 0);
                  const totalGstR = cgstR + sgstR + igstR;
                  const taxAmt = totalGstR > 0 ? lineTot / (1 + totalGstR / 100) : lineTot;

                  totalTaxable += taxAmt;
                  totalCgst += taxAmt * (cgstR / 100);
                  totalSgst += taxAmt * (sgstR / 100);
                  totalIgst += taxAmt * (igstR / 100);
                  grandTotal += lineTot;
                });

                const paid = Number(iPaidAmount) || 0;
                const balance = Math.max(0, grandTotal - paid);

                return (
                  <div className="live-total-box" style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", color: "#334155" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                        <span>Taxable Amount:</span>
                        <strong style={{ color: "#0f172a" }}>₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                        <span>CGST Total:</span>
                        <strong style={{ color: "#0f172a" }}>₹{totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                        <span>SGST Total:</span>
                        <strong style={{ color: "#0f172a" }}>₹{totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                        <span>IGST Total:</span>
                        <strong style={{ color: "#0f172a" }}>₹{totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div style={{ background: "#2563eb", color: "#ffffff", padding: "14px 18px", borderRadius: "8px", marginTop: "12px", boxShadow: "0 2px 4px rgba(37,99,235,0.2)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px", fontWeight: 700 }}>
                        <span>Total (Inclusive of GST)</span>
                        <span style={{ fontSize: "18px" }}>₹{grandTotal.toLocaleString("en-IN")}/-</span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#eff6ff", marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "6px" }}>
                        In Words: <strong style={{ color: "#ffffff" }}>{amountWords(grandTotal)}</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", padding: "4px 6px", fontSize: "13px", color: "#475569" }}>
                      <span>Paid Amount:</span>
                      <strong style={{ color: "#0f172a" }}>₹{paid.toLocaleString("en-IN")}</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", padding: "10px 14px", background: balance > 0 ? "#fef2f2" : "#f0fdf4", border: balance > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0", borderRadius: "6px", fontSize: "14.5px", fontWeight: 700, color: balance > 0 ? "#dc2626" : "#16a34a" }}>
                      <span>Balance Due:</span>
                      <span>₹{balance.toLocaleString("en-IN")}</span>
                    </div>
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
                  <input
                    value={aCustName}
                    onChange={e => setACustName(e.target.value)}
                    placeholder="Enter Consumer Name"
                    required
                  />
                </label>
                <label>Consumer Mobile<input value={aCustMobile} onChange={e => setACustMobile(e.target.value)} required /></label>
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
              <h2 style={{ margin: 0 }}>Cashfree Payment Gateway</h2>
              <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                ⚡ Cashfree Secure
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
                <strong>₹1</strong>
              </div>
            </div>

            <div style={{ background: "#eff6ff", padding: "10px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1e40af", marginBottom: "16px" }}>
              💳 <strong>Supported Methods:</strong> Cashfree UPI (Google Pay, PhonePe, Paytm), QR Code, Credit/Debit Cards, NetBanking &amp; Wallets.
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
                    const targetId = payuRow.id || payuRow._id || payuRow.agreement_number;
                    const cfData = await api(`/agreements/${targetId}/cashfree-initiate`, {
                      method: "POST",
                    });

                    if (cfData && cfData.payment_session_id) {
                      toast.success("Opening Cashfree Secure Checkout…");

                      const startCheckout = () => {
                        try {
                          const cashfree = window.Cashfree({
                            mode: cfData.environment || "sandbox",
                          });
                          cashfree.checkout({
                            paymentSessionId: cfData.payment_session_id,
                            redirectTarget: "_self",
                          });
                        } catch {
                          const checkoutUrl = cfData.environment === "production"
                            ? `https://api.cashfree.com/pg/orders?payment_session_id=${cfData.payment_session_id}`
                            : `https://sandbox.cashfree.com/pg/orders?payment_session_id=${cfData.payment_session_id}`;
                          window.location.href = checkoutUrl;
                        }
                      };

                      if (typeof window.Cashfree === "function") {
                        startCheckout();
                      } else {
                        const script = document.createElement("script");
                        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
                        script.onload = startCheckout;
                        script.onerror = () => {
                          const checkoutUrl = cfData.environment === "production"
                            ? `https://api.cashfree.com/pg/orders?payment_session_id=${cfData.payment_session_id}`
                            : `https://sandbox.cashfree.com/pg/orders?payment_session_id=${cfData.payment_session_id}`;
                          window.location.href = checkoutUrl;
                        };
                        document.head.appendChild(script);
                      }
                    } else {
                      throw new Error(cfData?.message || "Cashfree checkout initiation failed");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Cashfree payment failed");
                    setPaying(false);
                  }
                }}
              >
                {paying ? "Opening Cashfree Gateway…" : "Pay Now via Cashfree 🚀"}
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
                          {canEdit && (title === "Quotations" || title === "Invoices" || title === "Agreements") && (
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
                                🔒 Pay via Cashfree
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
        ["address", "Address / Site Address", "text", null, false],
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
        ["created_at", "Date", (v) => formatDateDDMMYYYY(v)],
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
      const compressed = await compressLogoOrSignature(clean);
      setCompanyLogoUrl(compressed);
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
      const compressed = await compressLogoOrSignature(clean);
      setCompanySignatureUrl(compressed);
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

  const isCustomer = user?.roles?.includes("customer");
  const bank = user?.bank_details || user?.bankDetails || {};

  return (
    <main className="app-page">
      <span className="kicker">MY ACCOUNT</span>
      <h1>Profile &amp; security</h1>
      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "24px" }}>
        <form className="card operational-form" onSubmit={profile}>
          <h2>{isCustomer ? "My Profile Information" : "Admin Profile & Company Setup"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label>
              Full name
              <input name="fullName" defaultValue={user?.fullName || user?.full_name} required />
            </label>
            <label>
              Mobile / Phone
              <input name="phone" defaultValue={user?.phone || user?.mobile} />
            </label>
          </div>

          {!isCustomer && (
            <>
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
            </>
          )}

          <button className="primary" style={{ marginTop: "24px" }}>
            {isCustomer ? "Save Profile Details" : "Save Profile, Branding & Bank Details"}
          </button>
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
