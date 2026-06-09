import { dbSource } from "../src/db/localDb.js";

console.log("Resembrando base de datos local (db-local.json)...");
dbSource.reseed();
console.log("Listo. Usuarios de prueba:");
console.log("  superadmin / superadmin123  (SuperAdmin global)");
console.log("  presidente / admin123       (Presidente / admin)");
console.log("  vecino_juan / vecino123     (Propietario)");
console.log("  vecina_maria / vecino123    (Inquilina)");
console.log("Código de invitación: ALAMEDA2026");
