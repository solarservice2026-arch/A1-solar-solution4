import mongoose from "mongoose";

/**
 * Generates a company prefix from the company name.
 * Takes the first letter of the first two meaningful words.
 * Examples:
 *   "Ayush Infotech"      → "AI"
 *   "A1 Solar Solution"   → "AS"
 *   "XYZ Technologies"    → "XT"
 */
export function generatePrefix(companyName) {
  if (!companyName || typeof companyName !== "string") return "AI";
  const words = companyName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "AI";
  if (words.length === 1) {
    // Single word: take first two letters
    return words[0].slice(0, 2).toUpperCase();
  }
  // Multiple words: first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Pads a sequence number to at least 4 digits.
 * 101 → "0101", 9999 → "9999", 10000 → "10000"
 */
function padSequence(num) {
  return String(num).padStart(4, "0");
}

/**
 * Reads the company prefix from the company_settings collection.
 * Dynamically keeps the prefix aligned with company_name (defaults to "Ayush Infotech" -> "AI").
 */
export async function getCompanyPrefix(mongo) {
  try {
    const settings = await mongo
      .collection("company_settings")
      .findOne({ _id: "primary" });

    if (settings && settings.company_name) {
      const derivedPrefix = generatePrefix(settings.company_name);
      if (settings.prefix !== derivedPrefix) {
        await mongo.collection("company_settings").updateOne(
          { _id: "primary" },
          { $set: { prefix: derivedPrefix, updated_at: new Date() } }
        );
      }
      return derivedPrefix;
    }

    if (settings && settings.prefix) {
      return settings.prefix;
    }

    // If no settings exist yet, derive from env or default ("Ayush Infotech" -> "AI")
    const companyName = process.env.COMPANY_NAME || "Ayush Infotech";
    const prefix = generatePrefix(companyName);

    await mongo.collection("company_settings").updateOne(
      { _id: "primary" },
      {
        $setOnInsert: {
          _id: "primary",
          company_name: companyName,
          prefix,
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
    return prefix;
  } catch (err) {
    console.error("[SequenceCounter] Failed to read company prefix:", err.message);
    return generatePrefix(process.env.COMPANY_NAME || "Ayush Infotech");
  }
}

/**
 * Smartly segregates brand/company name into a 2-letter uppercase prefix.
 * Examples:
 *   "LivFast" / "Liv Fast"  → "LF"
 *   "Anchor" / "anchor"    → "AN"
 *   "Tata Power"           → "TP"
 *   "A1 Select"            → "AS"
 *   "Havells"              → "HA"
 *   "" / null              → defaultPrefix (e.g. "AI")
 */
export function getBrandPrefix(brandName, defaultPrefix = "AI") {
  if (!brandName || typeof brandName !== "string") return defaultPrefix;
  const cleaned = brandName.trim();
  if (!cleaned) return defaultPrefix;

  // Split by whitespace or non-alphanumeric characters
  const words = cleaned.split(/[\s_\-]+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Single word: check for CamelCase / PascalCase like "LivFast" -> 'L', 'F'
  const capitals = cleaned.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return (capitals[0] + capitals[1]).toUpperCase();
  }

  // Otherwise, take first two letters
  const letters = cleaned.replace(/[^a-zA-Z0-9]/g, "");
  if (letters.length >= 2) {
    return letters.slice(0, 2).toUpperCase();
  }
  if (letters.length === 1) {
    return (letters[0] + "X").toUpperCase();
  }
  return defaultPrefix;
}

/**
 * Atomically generates the next sequential number for a given document type and optional brand.
 *
 * Standard Format: [BRAND_PREFIX]-[DOC_TYPE]-[YEAR]-[0101]
 * Examples:
 *   Quotation: LF-QOT-2026-0101
 *   Invoice:   LF-INV-2026-0101
 *   Agreement: LF-AGR-2026-0101
 *   Customer:  AI-CUS-2026-0101
 *   Project:   AI-PRJ-2026-0101
 *   Ticket:    AI-TKT-2026-0101
 *
 * @param {object} mongo     - The MongoDB database instance (mongoose.connection.db)
 * @param {string} type      - Document type code: "QOT", "QUO", "INV", "AGR", "CUS", "PRJ", "TKT", "CON", "EST", "SKU"
 * @param {string} brandName - Optional brand or product name (e.g. "LivFast")
 * @returns {string} Formatted number like "LF-QOT-2026-0101"
 */
export async function getNextNumber(mongo, type, brandName = null) {
  const companyPrefix = await getCompanyPrefix(mongo);
  const prefix = brandName ? getBrandPrefix(brandName, companyPrefix) : companyPrefix;

  let normalizedType = String(type).toUpperCase();
  if (normalizedType === "QUO") normalizedType = "QOT";

  const year = new Date().getFullYear();

  // Ensure counter document exists starting at seq: 100 before $inc
  await mongo.collection("counters").updateOne(
    { _id: normalizedType },
    { $setOnInsert: { _id: normalizedType, seq: 100 } },
    { upsert: true }
  );

  const result = await mongo.collection("counters").findOneAndUpdate(
    { _id: normalizedType },
    { $inc: { seq: 1 } },
    { returnDocument: "after" }
  );

  const doc = result?.value ?? result;
  let seq = doc?.seq;

  if (!seq || seq < 101) {
    const corrected = await mongo.collection("counters").findOneAndUpdate(
      { _id: normalizedType, seq: { $lt: 101 } },
      { $set: { seq: 101 } },
      { returnDocument: "after" }
    );
    const correctedDoc = corrected?.value ?? corrected;
    seq = correctedDoc?.seq ?? 101;
  }

  return `${prefix}-${normalizedType}-${year}-${padSequence(seq)}`;
}

/**
 * Previews the next number that would be generated, WITHOUT consuming it.
 * This is used by the frontend to show the expected number in forms.
 */
export async function peekNextNumber(mongo, type, brandName = null) {
  const companyPrefix = await getCompanyPrefix(mongo);
  const prefix = brandName ? getBrandPrefix(brandName, companyPrefix) : companyPrefix;

  let normalizedType = String(type).toUpperCase();
  if (normalizedType === "QUO") normalizedType = "QOT";

  const year = new Date().getFullYear();

  const counter = await mongo.collection("counters").findOne({ _id: normalizedType });
  const currentSeq = counter?.seq ?? 100;
  const nextSeq = currentSeq < 100 ? 101 : currentSeq + 1;

  return `${prefix}-${normalizedType}-${year}-${padSequence(nextSeq)}`;
}
