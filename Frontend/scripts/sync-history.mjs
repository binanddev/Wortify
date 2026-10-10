import fs from "node:fs/promises";
const source=new URL("../../history.md",import.meta.url);
try {await fs.copyFile(source,new URL("../src/features/admin/history.md",import.meta.url));console.log("Admin change log synchronized.");}
catch(error){if(error.code!=="ENOENT")throw error;console.log("Using bundled Admin change log (standalone Frontend).");}
