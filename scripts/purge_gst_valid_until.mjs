import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../server/.env") });

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/a1solar";

async function run() {
  console.log("Connecting to MongoDB:", uri);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const collections = ["quotations", "invoices", "agreements", "customers", "estimates", "contracts"];

  for (const colName of collections) {
    const col = db.collection(colName);
    const res = await col.updateMany(
      {},
      {
        $unset: {
          customer_gst: "",
          customer_gstin: "",
          customerGst: "",
          customerGstin: "",
          gst_number: "",
          valid_until: "",
          validUntil: "",
          valid_date: "",
          "customers.gst_number": "",
          "customers.gstNumber": ""
        }
      }
    );
    console.log(`Purged ${colName}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await client.close();
  console.log("Database purge complete!");
}

run().catch(console.error);
