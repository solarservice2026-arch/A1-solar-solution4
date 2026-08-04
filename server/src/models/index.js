import mongoose from "mongoose";

const baseOwnershipSchema = {
  ownerId: { type: String, required: true, index: true },
  ownerRole: { type: String, required: true, index: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  status: { type: String, default: "Active", index: true },
};

// 1. Quotation Schema
const quotationSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  quotation_number: { type: String, required: true, unique: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  customer_mobile: { type: String },
  customer_email: { type: String },
  customer_gst: { type: String },
  quotation_date: { type: String },
  valid_until: { type: String },
  capacity_kw: { type: Number, default: 0 },
  quotation_type: { type: String, default: "Residential" },
  title: { type: String, default: "Solar Installation Quotation" },
  installation_address: { type: String },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  terms: { type: String },
  quotation_items: { type: Array, default: [] },
  customer_signature_url: { type: String },
}, { timestamps: true });

quotationSchema.index({ ownerId: 1, createdAt: -1 });
quotationSchema.index({ ownerId: 1, status: 1 });
quotationSchema.index({ createdAt: -1 });

// 2. Invoice Schema
const invoiceSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  invoice_number: { type: String, required: true, unique: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  customer_mobile: { type: String },
  customer_email: { type: String },
  customer_gst: { type: String },
  invoice_date: { type: String },
  due_date: { type: String },
  title: { type: String, default: "Solar Invoice" },
  installation_address: { type: String },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paid_amount: { type: Number, default: 0 },
  invoice_items: { type: Array, default: [] },
}, { timestamps: true });

invoiceSchema.index({ ownerId: 1, createdAt: -1 });
invoiceSchema.index({ ownerId: 1, status: 1 });
invoiceSchema.index({ createdAt: -1 });

// 3. Agreement Schema
const agreementSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  agreement_number: { type: String, required: true, unique: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  customer_email: { type: String },
  customer_mobile: { type: String },
  quotation_id: { type: String },
  quotation_number: { type: String },
  payment_status: { type: String, default: "Unpaid", index: true },
  payment_amount: { type: Number, default: 1 },
  consumer_address: { type: String },
  capacity_kw: { type: Number, default: 3 },
  terms_of_payment: { type: String },
  agreement_date: { type: String },
  customer_signature_url: { type: String },
  payu_txnid: { type: String },
  paid_at: { type: String },
  payment_method: { type: String },
}, { timestamps: true });

agreementSchema.index({ ownerId: 1, createdAt: -1 });
agreementSchema.index({ ownerId: 1, status: 1 });
agreementSchema.index({ createdAt: -1 });

// 4. Contract Schema
const contractSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  contract_number: { type: String, required: true, unique: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  title: { type: String, default: "Solar Maintenance Contract" },
  start_date: { type: String },
  end_date: { type: String },
  contract_value: { type: Number, default: 0 },
  terms: { type: String },
}, { timestamps: true });

contractSchema.index({ ownerId: 1, createdAt: -1 });
contractSchema.index({ ownerId: 1, status: 1 });
contractSchema.index({ createdAt: -1 });

// 5. Estimate Schema
const estimateSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  estimate_number: { type: String, required: true, unique: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  title: { type: String, default: "Project Solar Estimate" },
  estimated_cost: { type: Number, default: 0 },
  capacity_kw: { type: Number, default: 0 },
  valid_until: { type: String },
  items: { type: Array, default: [] },
}, { timestamps: true });

estimateSchema.index({ ownerId: 1, createdAt: -1 });
estimateSchema.index({ ownerId: 1, status: 1 });
estimateSchema.index({ createdAt: -1 });

// 6. Attachment Schema
const attachmentSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  filename: { type: String, required: true },
  file_url: { type: String, required: true },
  file_type: { type: String },
  file_size: { type: Number },
  resource_type: { type: String }, // quotation, invoice, agreement, etc.
  resource_id: { type: String },
}, { timestamps: true });

attachmentSchema.index({ ownerId: 1, createdAt: -1 });
attachmentSchema.index({ ownerId: 1, status: 1 });
attachmentSchema.index({ createdAt: -1 });

// 7. Note Schema
const noteSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  title: { type: String, required: true },
  content: { type: String, required: true },
  resource_type: { type: String },
  resource_id: { type: String },
}, { timestamps: true });

noteSchema.index({ ownerId: 1, createdAt: -1 });
noteSchema.index({ ownerId: 1, status: 1 });
noteSchema.index({ createdAt: -1 });

// 8. Customer Schema
const customerSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  customer_number: { type: String, required: true, unique: true },
  profile_id: { type: String },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  customer_type: { type: String, default: "Residential" },
  gst_number: { type: String },
  consumer_number: { type: String },
  provider: { type: String },
}, { timestamps: true });

customerSchema.index({ ownerId: 1, createdAt: -1 });
customerSchema.index({ ownerId: 1, status: 1 });
customerSchema.index({ createdAt: -1 });

// 9. Project Schema
const projectSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  project_number: { type: String, required: true },
  name: { type: String, required: true },
  customer_id: { type: String },
  assigned_to: { type: String },
  stage: { type: String, default: "Site Assessment" },
  progress: { type: Number, default: 0 },
}, { timestamps: true });

projectSchema.index({ ownerId: 1, createdAt: -1 });
projectSchema.index({ ownerId: 1, status: 1 });

// 10. Ticket Schema
const ticketSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  ticket_number: { type: String, required: true },
  title: { type: String, required: true },
  customer_id: { type: String },
  assigned_to: { type: String },
  priority: { type: String, default: "Medium" },
  resolution: { type: String },
  opened_at: { type: Date, default: Date.now },
  closed_at: { type: Date },
}, { timestamps: true });

ticketSchema.index({ ownerId: 1, createdAt: -1 });
ticketSchema.index({ ownerId: 1, status: 1 });

// 11. Product Schema
const productSchema = new mongoose.Schema({
  ...baseOwnershipSchema,
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String },
  brand: { type: String },
  model: { type: String },
  unit: { type: String, default: "Nos" },
  purchase_price: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  tax_rate: { type: Number, default: 0 },
  minimum_stock: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ ownerId: 1, createdAt: -1 });
productSchema.index({ ownerId: 1, status: 1 });

export const Quotation = mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema, "quotations");
export const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema, "invoices");
export const Agreement = mongoose.models.Agreement || mongoose.model("Agreement", agreementSchema, "agreements");
export const Contract = mongoose.models.Contract || mongoose.model("Contract", contractSchema, "contracts");
export const Estimate = mongoose.models.Estimate || mongoose.model("Estimate", estimateSchema, "estimates");
export const Attachment = mongoose.models.Attachment || mongoose.model("Attachment", attachmentSchema, "attachments");
export const Note = mongoose.models.Note || mongoose.model("Note", noteSchema, "notes");
export const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema, "customers");
export const Project = mongoose.models.Project || mongoose.model("Project", projectSchema, "projects");
export const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema, "service_tickets");
export const Product = mongoose.models.Product || mongoose.model("Product", productSchema, "products");

export const modelMap = {
  quotations: Quotation,
  invoices: Invoice,
  agreements: Agreement,
  contracts: Contract,
  estimates: Estimate,
  attachments: Attachment,
  notes: Note,
  customers: Customer,
  projects: Project,
  tickets: Ticket,
  products: Product,
};
