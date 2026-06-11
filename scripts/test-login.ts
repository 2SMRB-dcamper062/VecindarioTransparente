import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const DB_FILE = path.resolve(process.cwd(), "db-local.json");

async function main() {
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const data = JSON.parse(raw);
  const user = data.users.find((u: any) => u.username === "superadmin");
  const match = await bcrypt.compare("superadmin123", user.passwordHash);
  console.log("Hash:", user.passwordHash);
  console.log("Match:", match);
  if (!match) {
    console.log("Generando nuevo hash...");
    user.passwordHash = await bcrypt.hash("superadmin123", 10);
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.log("Hash actualizado.");
  }
}

main().catch(console.error);
