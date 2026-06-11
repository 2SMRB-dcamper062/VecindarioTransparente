import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const DB_FILE = path.resolve(process.cwd(), "db-local.json");

async function main() {
  const users = [
    { _id: "user_superadmin", username: "superadmin", name: "Super Admin", email: "superadmin@vecindariotransparente.es", password: "superadmin123", role: "admin", status: "active", communityId: "comm_demo" },
    { _id: "user_presidente", username: "presidente", name: "Presidente Demo", email: "presidente@vecindariotransparente.es", password: "admin123", role: "presidente", status: "active", communityId: "comm_demo" },
    { _id: "user_vecino_juan", username: "vecino_juan", name: "Vecino Juan", email: "juan@vecindariotransparente.es", password: "vecino123", role: "vecino", status: "active", communityId: "comm_demo" },
    { _id: "user_vecina_maria", username: "vecina_maria", name: "Vecina Maria", email: "maria@vecindariotransparente.es", password: "vecino123", role: "vecino", status: "active", communityId: "comm_demo" }
  ];

  const communities = [
    { _id: "comm_demo", name: "Comunidad Demo", address: "Calle Demo 123", inviteCode: "ALAMEDA2026" }
  ];

  for (const u of users) {
    u.passwordHash = await bcrypt.hash(u.password, 10);
    delete u.password;
  }

  const data = {
    users,
    communities,
    properties: [],
    votes: [],
    finances: [],
    bookings: [],
    issues: [],
    subscriptions: []
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log("db-local.json generado con usuarios y hashes correctos.");
}

main().catch(console.error);
