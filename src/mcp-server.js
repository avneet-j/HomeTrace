import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { load, save, localDate, isDate, addMonths, daysBetween, findAppliance } from "./store.js";

const text = (t) => ({ content: [{ type: "text", text: t }] });
const bad = (t) => ({ content: [{ type: "text", text: t }], isError: true });
const rel = (n) => (n < 0 ? `${-n} days overdue` : n === 0 ? "today" : `in ${n} days`);

const STOP = new Set([
  "the", "an", "of", "is", "was", "were", "when", "last", "did", "do", "we", "my", "our", "for", "to",
  "and", "on", "in", "at", "what", "which", "who", "how", "any", "ever", "been", "has", "have", "history", "me",
]);

function tokens(q) {
  return String(q || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

function ensureAppliance(d, name) {
  let a = findAppliance(d, name);
  if (!a) {
    a = { id: d.nextId++, name: String(name).trim(), brand: null, purchaseDate: null, warrantyExpires: null, nextServiceDue: null };
    d.appliances.push(a);
  }
  return a;
}

const fmtLog = (l) =>
  `${l.date}: ${l.appliance} - ${l.action} [${l.type}]` +
  (l.technician ? ` by ${l.technician}` : "") +
  (l.cost != null ? `, Rs ${l.cost}` : "") +
  (l.notes ? `. Note: ${l.notes}` : "");

export function buildServer() {
  const server = new McpServer({ name: "hometrace", version: "1.0.0" });

  server.registerTool(
    "register_appliance",
    {
      title: "Register appliance",
      description: "Register or update a household appliance with brand, purchase date and warranty details.",
      inputSchema: {
        name: z.string().describe("Appliance name, e.g. Washing machine"),
        brand: z.string().optional(),
        purchase_date: z.string().optional().describe("YYYY-MM-DD"),
        warranty_months: z.number().optional().describe("Warranty length in months from purchase date"),
        warranty_expires: z.string().optional().describe("YYYY-MM-DD, if the expiry date is known directly"),
      },
    },
    async ({ name, brand, purchase_date, warranty_months, warranty_expires }) => {
      if (purchase_date && !isDate(purchase_date)) return bad("purchase_date must be YYYY-MM-DD.");
      if (warranty_expires && !isDate(warranty_expires)) return bad("warranty_expires must be YYYY-MM-DD.");
      const d = load();
      const a = ensureAppliance(d, name);
      if (brand) a.brand = brand;
      if (purchase_date) a.purchaseDate = purchase_date;
      if (warranty_expires) a.warrantyExpires = warranty_expires;
      else if (warranty_months && (purchase_date || a.purchaseDate))
        a.warrantyExpires = addMonths(purchase_date || a.purchaseDate, warranty_months);
      save(d);
      return text(`Saved ${a.name}${a.warrantyExpires ? `, warranty until ${a.warrantyExpires}` : ""}.`);
    }
  );

  server.registerTool(
    "log_maintenance",
    {
      title: "Log maintenance",
      description:
        "Record a service, repair, replacement or inspection of a household appliance or fixture. " +
        "If the technician recommends a next service, pass next_service_in_months instead of computing a date.",
      inputSchema: {
        appliance: z.string().describe("Appliance or fixture, e.g. RO water purifier"),
        action: z.string().describe("What was done, e.g. filter changed"),
        type: z.enum(["service", "repair", "replacement", "inspection", "other"]).optional(),
        date: z.string().optional().describe("YYYY-MM-DD. Defaults to today."),
        technician: z.string().optional().describe("Who did the work or which company"),
        cost: z.number().optional().describe("Cost in rupees"),
        notes: z.string().optional().describe("Anything the technician advised or warned about"),
        next_service_in_months: z.number().optional().describe("Months until the next service is recommended"),
      },
    },
    async ({ appliance, action, type, date, technician, cost, notes, next_service_in_months }) => {
      const when = date || localDate();
      if (!isDate(when)) return bad("date must be YYYY-MM-DD.");
      const d = load();
      const a = ensureAppliance(d, appliance);
      const entry = {
        id: d.nextId++, applianceId: a.id, appliance: a.name, type: type || "service", action, date: when,
        technician: technician || null, cost: cost ?? null, notes: notes || null,
      };
      d.logs.push(entry);
      if (next_service_in_months) a.nextServiceDue = addMonths(when, next_service_in_months);
      else if (["service", "replacement"].includes(entry.type)) a.nextServiceDue = null;
      save(d);
      return text(
        `Logged: ${a.name} - ${action} on ${when}.` +
          (next_service_in_months ? ` Next service due ${a.nextServiceDue}.` : "")
      );
    }
  );

  server.registerTool(
    "find_service_history",
    {
      title: "Find service history",
      description:
        "Search recorded maintenance history. Use short keywords such as an appliance name, brand or technician. " +
        "Use the type filter for questions like 'last repaired'. Results are newest first.",
      inputSchema: {
        query: z.string().optional().describe("Short keywords, e.g. washing machine"),
        type: z.enum(["service", "repair", "replacement", "inspection", "other"]).optional(),
        limit: z.number().optional().describe("Max results, default 5"),
      },
    },
    async ({ query, type, limit }) => {
      const d = load();
      let logs = d.logs.filter((l) => !type || l.type === type);
      const toks = tokens(query);
      if (toks.length) {
        const scored = logs.map((l) => {
          const brand = d.appliances.find((a) => a.id === l.applianceId)?.brand || "";
          const hay = [l.appliance, brand, l.type, l.action, l.technician, l.notes].filter(Boolean).join(" ").toLowerCase();
          return { l, score: toks.filter((t) => hay.includes(t)).length };
        });
        const max = Math.max(0, ...scored.map((s) => s.score));
        logs = max === 0 ? [] : scored.filter((s) => s.score === max).map((s) => s.l);
      }
      logs.sort((a, b) => b.date.localeCompare(a.date));
      logs = logs.slice(0, limit || 5);
      if (!logs.length) return text("I have no matching records.");
      return text(logs.map(fmtLog).join("\n"));
    }
  );

  server.registerTool(
    "check_warranty",
    {
      title: "Check warranty",
      description:
        "Check the warranty of one appliance, or list all warranties expiring within a number of days " +
        "(use 31 for 'next month').",
      inputSchema: {
        appliance: z.string().optional(),
        within_days: z.number().optional().describe("Window in days, default 30"),
      },
    },
    async ({ appliance, within_days }) => {
      const d = load();
      const t = localDate();
      if (appliance) {
        const a = findAppliance(d, appliance);
        if (!a) return text(`I have no record of ${appliance}.`);
        if (!a.warrantyExpires) return text(`${a.name} has no warranty date on record.`);
        const days = daysBetween(t, a.warrantyExpires);
        return text(
          days >= 0
            ? `${a.name} is under warranty until ${a.warrantyExpires} (${days} days left).`
            : `The warranty on ${a.name} expired on ${a.warrantyExpires} (${-days} days ago).`
        );
      }
      const win = within_days ?? 30;
      const list = d.appliances
        .filter((a) => a.warrantyExpires)
        .map((a) => ({ a, days: daysBetween(t, a.warrantyExpires) }))
        .filter((x) => x.days >= 0 && x.days <= win)
        .sort((x, y) => x.days - y.days);
      if (!list.length) return text(`No warranties expire in the next ${win} days.`);
      return text(list.map((x) => `${x.a.name}: expires ${x.a.warrantyExpires} (${rel(x.days)})`).join("\n"));
    }
  );

  server.registerTool(
    "schedule_followup",
    {
      title: "Schedule follow-up",
      description: "Create a reminder to follow up with a technician or do a maintenance task on a date.",
      inputSchema: {
        task: z.string().describe("What to follow up on"),
        due: z.string().describe("YYYY-MM-DD"),
        contact: z.string().optional().describe("Person or company to contact"),
        appliance: z.string().optional(),
      },
    },
    async ({ task, due, contact, appliance }) => {
      if (!isDate(due)) return bad("due must be YYYY-MM-DD.");
      const d = load();
      const f = { id: d.nextId++, task, due, contact: contact || null, appliance: appliance || null, done: false };
      d.followups.push(f);
      save(d);
      return text(`Reminder set: ${task} on ${due}${contact ? ` (contact: ${contact})` : ""}.`);
    }
  );

  server.registerTool(
    "complete_followup",
    {
      title: "Complete follow-up",
      description: "Mark a follow-up as done, by id or by part of its text.",
      inputSchema: { id: z.number().optional(), task: z.string().optional() },
    },
    async ({ id, task }) => {
      const d = load();
      const open = d.followups.filter((f) => !f.done);
      const f =
        id != null
          ? open.find((x) => x.id === id)
          : open.find((x) => task && x.task.toLowerCase().includes(task.toLowerCase()));
      if (!f) return text("I couldn't find a matching open follow-up.");
      f.done = true;
      save(d);
      return text(`Marked done: ${f.task}.`);
    }
  );

  server.registerTool(
    "get_upcoming",
    {
      title: "Upcoming items",
      description: "Proactive digest of warranties expiring, services due and follow-ups due within a number of days.",
      inputSchema: { days: z.number().optional().describe("Window in days, default 30") },
    },
    async ({ days }) => {
      const d = load();
      const t = localDate();
      const win = days ?? 30;
      const lines = [];

      const warr = d.appliances
        .filter((a) => a.warrantyExpires)
        .map((a) => ({ a, n: daysBetween(t, a.warrantyExpires) }))
        .filter((x) => x.n >= 0 && x.n <= win);
      if (warr.length) lines.push("Warranties expiring: " + warr.map((x) => `${x.a.name} (${rel(x.n)})`).join("; "));

      const svc = d.appliances
        .filter((a) => a.nextServiceDue)
        .map((a) => ({ a, n: daysBetween(t, a.nextServiceDue) }))
        .filter((x) => x.n <= win);
      if (svc.length) lines.push("Services due: " + svc.map((x) => `${x.a.name} (${rel(x.n)})`).join("; "));

      const fu = d.followups
        .filter((f) => !f.done)
        .map((f) => ({ f, n: daysBetween(t, f.due) }))
        .filter((x) => x.n <= win);
      if (fu.length)
        lines.push("Follow-ups: " + fu.map((x) => `${x.f.task}${x.f.contact ? ` (${x.f.contact})` : ""} (${rel(x.n)})`).join("; "));

      return text(lines.length ? lines.join("\n") : `Nothing due in the next ${win} days.`);
    }
  );

  return server;
}