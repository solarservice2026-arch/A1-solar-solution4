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
 * Atomically generates the next sequential number for a given document type.
 *
 * Uses MongoDB findOneAndUpdate with $inc and upsert for atomicity.
 * The counter starts at seq=100 so the first $inc yields 101 → "0101".
 * Never reuses deleted numbers, and guarantees uniqueness across concurrent requests.
 *
 * @param {object} mongo - The MongoDB database instance (mongoose.connection.db)
 * @param {string} type  - Document type code: "INV", "QUO", "AGR", "CUS", "PRJ", "TKT", "CON", "EST", "SKU"
 * @returns {string} Formatted number like "AI-INV-0101"
 */
export async function getNextNumber(mongo, type) {
  const prefix = await getCompanyPrefix(mongo);

  // Ensure counter document exists starting at seq: 100 before $inc
  await mongo.collection("counters").updateOne(
    { _id: type },
    { $setOnInsert: { _id: type, seq: 100 } },
    { upsert: true }
  );

  const result = await mongo.collection("counters").findOneAndUpdate(
    { _id: type },
    { $inc: { seq: 1 } },
    { returnDocument: "after" }
  );

  const doc = result?.value ?? result;
  let seq = doc?.seq;

  if (!seq || seq < 101) {
    const corrected = await mongo.collection("counters").findOneAndUpdate(
      { _id: type, seq: { $lt: 101 } },
      { $set: { seq: 101 } },
      { returnDocument: "after" }
    );
    const correctedDoc = corrected?.value ?? corrected;
    seq = correctedDoc?.seq ?? 101;
  }

  return `${prefix}-${type}-${padSequence(seq)}`;
}

/**
 * Previews the next number that would be generated, WITHOUT consuming it.
 * This is used by the frontend to show the expected number in forms.
 */
export async function peekNextNumber(mongo, type) {
  const prefix = await getCompanyPrefix(mongo);

  const counter = await mongo.collection("counters").findOne({ _id: type });
  const currentSeq = counter?.seq ?? 100;
  const nextSeq = currentSeq < 100 ? 101 : currentSeq + 1;

  return `${prefix}-${type}-${padSequence(nextSeq)}`;
}
