import bcrypt from "bcryptjs";
import fs from "fs";

const DB_FILE = "db-local.json";

async function main() {
  const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

  const creds = [
    { username: "superadmin", password: "superadmin123" },
    { username: "presidente", password: "admin123" },
    { username: "vecino_juan", password: "vecino123" },
    { username: "vecina_maria", password: "vecino123" }
  ];

  for (const c of creds) {
    const user = data.users.find((u: any) => u.username === c.username);
    if (user) {
      const hash = await bcrypt.hash(c.password, 10);
      user.passwordHash = hash.replace("$2b$", "$2a$");
      console.log(`Updated ${c.username}: ${user.passwordHash}`);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log("Hashes regenerados con prefijo $2a$.");
}

main().catch(console.error);
