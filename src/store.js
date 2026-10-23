import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "data.json");

const DEFAULT = { appliances: [], logs: [], followups: [], nextId: 1 };

export function load() {
  try {
    return { ...structuredClone(DEFAULT), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function save(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

const pad = (n) => String(n).padStart(2, "0");
export const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const localDate = () => fmt(new Date());

export function isDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00"));
}

export function addMonths(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  if (dt.getDate() !== d) dt.setDate(0); // clamp, e.g. Aug 31 + 6 months -> Feb 28
  return fmt(dt);
}

export function addDays(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export function daysBetween(a, b) {
  const p = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / 86400000);
}

export function findAppliance(d, name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return (
    d.appliances.find((a) => a.name.toLowerCase() === n) ||
    d.appliances.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()))
  );
}

export function seed() {
  const t = localDate();
  const d = structuredClone(DEFAULT);
  const id = () => d.nextId++;
  const app = (name, brand, purchaseDate, warrantyExpires, nextServiceDue = null) => {
    const a = { id: id(), name, brand, purchaseDate, warrantyExpires, nextServiceDue };
    d.appliances.push(a);
    return a;
  };
  const log = (a, type, action, date, technician, cost, notes) =>
    d.logs.push({ id: id(), applianceId: a.id, appliance: a.name, type, action, date, technician, cost, notes });

  const wm = app("Washing machine", "LG", addMonths(t, -23), addDays(t, 24));
  const ro = app("RO water purifier", "Kent", addMonths(t, -10), addMonths(t, 2), addMonths(t, 1));
  const ac = app("Air conditioner", "Daikin", addMonths(t, -30), addMonths(t, -6), addMonths(t, 4));
  const gy = app("Geyser", "Racold", addMonths(t, -11), addMonths(t, 1));

  log(wm, "repair", "drain pump replaced", addMonths(t, -4), "Ramesh (LG service)", 1800,
    "Technician said the drum bearing may wear out within a year");
  log(ro, "replacement", "filter changed", addMonths(t, -5), "Sunil (Kent)", 1200,
    "Replace the filter again in six months");
  log(ac, "service", "annual gas check and deep clean", addMonths(t, -8), "CoolCare Services", 900, null);
  log(gy, "repair", "thermostat replaced", addMonths(t, -2), "Mehta Electricals", 650,
    "Wiring near the geyser looked old; electrician suggested a follow-up");

  d.followups.push({
    id: id(), task: "Call the electrician about the geyser wiring", due: addDays(t, 3),
    contact: "Mehta Electricals", appliance: "Geyser", done: false,
  });
  save(d);
}