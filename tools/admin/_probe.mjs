import { api } from "./_env.mjs";
const [,, path] = process.argv;
const r = await api(path.startsWith("/") ? path : "/" + path);
console.log(r.status, JSON.stringify(r.json, null, 1).slice(0, 3000));
