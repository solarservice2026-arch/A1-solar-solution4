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
 * Smartly segregates brand/company name into a 2-or-3 letter uppercase prefix.
 * Examples:
 *   "A1 Solution" / "A1 Solar Solution" → "A1S"
 *   "LivFast" / "Liv Fast"              → "LF"
 *   "Anchor" / "anchor"                → "AN"
 *   "Tata Power"                       → "TP"
 *   "" / null                          → "A1S"
 */
export function getBrandPrefix(brandName, defaultPrefix = "A1S") {
  if (!brandName || typeof brandName !== "string") return defaultPrefix;
  const cleaned = brandName.trim();
  if (!cleaned) return defaultPrefix;

  const words = cleaned.split(/[\s_\-]+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    if (words[0].length === 2 && /\d/.test(words[0])) {
      // e.g. "A1 Solution" or "A1 Solar Solution" -> "A1" + "S" = "A1S"
      return (words[0] + words[1][0]).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const capitals = cleaned.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return (capitals[0] + capitals[1]).toUpperCase();
  }

  const letters = cleaned.replace(/[^a-zA-Z0-9]/g, "");
  if (letters.length >= 2) {
    return letters.slice(0, 3).toUpperCase();
  }
  return defaultPrefix;
}

/**
 * Atomically generates the next sequential number for a given document type and optional brand.
 * 
 * Uses year-scoped counter keys in MongoDB (_id: `${normalizedType}_${year}`) so sequence
 * automatically resets to 0101 every new year!
 *
 * Standard Formats:
 *   Invoice:   INV-A1S-2026-0101
 *   Quotation: QOT-LF-2026-0101
 *   Agreement: AGR-A1S-2026-0101
 *
 * @param {object} mongo     - The MongoDB database instance (mongoose.connection.db)
 * @param {string} type      - Document type code: "QOT", "QUO", "INV", "AGR", "CUS", "PRJ", "TKT", "CON", "EST", "SKU"
 * @param {string} brandName - Optional brand or product name (e.g. "A1 Solution", "LivFast")
 * @returns {string} Formatted number like "INV-A1S-2026-0101"
 */
export async function getNextNumber(mongo, type, brandName = null) {
  const companyPrefix = await getCompanyPrefix(mongo);
  const brandPref = brandName ? getBrandPrefix(brandName, "A1S") : "A1S";

  let normalizedType = String(type).toUpperCase();
  if (normalizedType === "QUO") normalizedType = "QOT";

  const year = new Date().getFullYear();
  const counterKey = `${normalizedType}_${year}`;

  // Ensure counter document exists starting at seq: 100 before $inc
  await mongo.collection("counters").updateOne(
    { _id: counterKey },
    { $setOnInsert: { _id: counterKey, seq: 100 } },
    { upsert: true }
  );

  const result = await mongo.collection("counters").findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { returnDocument: "after" }
  );

  const doc = result?.value ?? result;
  let seq = doc?.seq;

  if (!seq || seq < 101) {
    const corrected = await mongo.collection("counters").findOneAndUpdate(
      { _id: counterKey, seq: { $lt: 101 } },
      { $set: { seq: 101 } },
      { returnDocument: "after" }
    );
    const correctedDoc = corrected?.value ?? corrected;
    seq = correctedDoc?.seq ?? 101;
  }

  const paddedSeq = padSequence(seq);

  if (normalizedType === "INV") {
    return `INV-${brandPref}-${year}-${paddedSeq}`;
  } else if (normalizedType === "QOT") {
    return `QOT-${brandPref}-${year}-${paddedSeq}`;
  } else if (normalizedType === "AGR") {
    return `AGR-${brandPref}-${year}-${paddedSeq}`;
  }

  return `${brandPref}-${normalizedType}-${year}-${paddedSeq}`;
}

/**
 * Previews the next number that would be generated, WITHOUT consuming it.
 * This is used by the frontend to show the expected number in forms.
 */
export async function peekNextNumber(mongo, type, brandName = null) {
  const companyPrefix = await getCompanyPrefix(mongo);
  const brandPref = brandName ? getBrandPrefix(brandName, "A1S") : "A1S";

  let normalizedType = String(type).toUpperCase();
  if (normalizedType === "QUO") normalizedType = "QOT";

  const year = new Date().getFullYear();
  const counterKey = `${normalizedType}_${year}`;

  const counter = await mongo.collection("counters").findOne({ _id: counterKey });
  const currentSeq = counter?.seq ?? 100;
  const nextSeq = currentSeq < 100 ? 101 : currentSeq + 1;
  const paddedSeq = padSequence(nextSeq);

  if (normalizedType === "INV") {
    return `INV-${brandPref}-${year}-${paddedSeq}`;
  } else if (normalizedType === "QOT") {
    return `QOT-${brandPref}-${year}-${paddedSeq}`;
  } else if (normalizedType === "AGR") {
    return `AGR-${brandPref}-${year}-${paddedSeq}`;
  }

  return `${brandPref}-${normalizedType}-${year}-${paddedSeq}`;
}
