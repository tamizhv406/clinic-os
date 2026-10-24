import { supabase } from "../../lib/supabaseClient";
import type { MonitoringFilters, MonitoringLog, MonitoringLogInput, MonitoringService, SystemHealthLog } from "../interfaces";
import { supabaseAuthService } from "./supabaseAuth.service";

// The log tables (security_events, app_error_logs, system_health_checks) are not in
// the generated Database types and share one column layout, so they are queried
// through this narrow structural view instead of the typed client.
type LogRow = {
  id: string;
  clinic_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  event_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  status?: string | null;
  severity?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};
type LogQuery = PromiseLike<{ data: LogRow[] | null; error: unknown }> & {
  eq(column: string, value: string): LogQuery;
  gte(column: string, value: string): LogQuery;
  lte(column: string, value: string): LogQuery;
  order(column: string, options: { ascending: boolean }): LogQuery;
  limit(count: number): LogQuery;
};
type LogTable = {
  insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  select(columns: string): LogQuery;
};
const db = supabase as unknown as { from: (table: string) => LogTable };

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapLog(row: LogRow): MonitoringLog {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    branchId: row.branch_id,
    userId: row.user_id ?? row.actor_id,
    actorRole: row.actor_role,
    eventType: row.event_type ?? "audit",
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    status: row.status,
    severity: row.severity,
    message: row.message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at ?? "",
  };
}

async function context(input: MonitoringLogInput) {
  const auth = await supabaseAuthService.getCurrentAuthContext().catch(() => null);
  return {
    clinicId: input.clinicId ?? auth?.clinic_id ?? null,
    branchId: input.branchId ?? auth?.branch_id ?? null,
    userId: input.userId ?? auth?.staffProfileId ?? null,
    actorRole: input.actorRole ?? auth?.role_key ?? null,
  };
}

function payload(input: MonitoringLogInput, scoped: Awaited<ReturnType<typeof context>>) {
  return {
    clinic_id: scoped.clinicId,
    branch_id: scoped.branchId,
    actor_id: scoped.userId,
    user_id: scoped.userId,
    actor_role: scoped.actorRole,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: isUuid(input.entityId) ? input.entityId : null,
    action: input.action ?? input.eventType,
    status: input.status ?? "success",
    severity: input.severity ?? "info",
    message: input.message ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    metadata: input.metadata ?? {},
  };
}

function applyFilters(query: LogQuery, filters?: MonitoringFilters) {
  let next = query;
  if (filters?.clinicId) next = next.eq("clinic_id", filters.clinicId);
  if (filters?.dateFrom) next = next.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters?.dateTo) next = next.lte("created_at", `${filters.dateTo}T23:59:59`);
  if (filters?.status && filters.status !== "all") next = next.eq("status", filters.status);
  if (filters?.severity) next = next.eq("severity", filters.severity);
  if (filters?.module && filters.module !== "all") next = next.eq("entity_type", filters.module);
  return next.order("created_at", { ascending: false }).limit(filters?.limit ?? 50);
}

async function insert(table: string, input: MonitoringLogInput) {
  const scoped = await context(input);
  const { error } = await db.from(table).insert(payload(input, scoped));
  if (error) throw error;
}

async function select(table: string, filters?: MonitoringFilters) {
  const { data, error } = await applyFilters(db.from(table).select("*"), filters);
  if (error) throw error;
  return (data ?? []).map(mapLog);
}

/**
 * Writing a log line must never break the user-facing action that triggered it,
 * so log* swallows its error. Read paths surface errors to the caller.
 */
function ignoreWriteFailure(operation: Promise<void>) {
  return operation.catch((error) => {
    if (import.meta.env.DEV) console.warn("Monitoring log write failed:", error);
  });
}

export const supabaseMonitoringService: MonitoringService = {
  logAuditEvent(input) {
    return ignoreWriteFailure(insert("audit_logs", input));
  },
  logSecurityEvent(input) {
    return ignoreWriteFailure(insert("security_events", { ...input, eventType: input.eventType || "security_event", severity: input.severity ?? "warning", status: input.status ?? "recorded" }));
  },
  logAppError(input) {
    return ignoreWriteFailure(insert("app_error_logs", { ...input, eventType: input.eventType || "app_error", severity: input.severity ?? "error", status: input.status ?? "open" }));
  },
  logHealthCheck(input) {
    return ignoreWriteFailure(insert("system_health_checks", { ...input, eventType: input.eventType || "health_check", status: input.status ?? "ok" }));
  },
  getAuditLogs(filters) {
    return select("audit_logs", filters);
  },
  getSystemHealth(filters) {
    return select("system_health_checks", filters) as Promise<SystemHealthLog[]>;
  },
  getErrorLogs(filters) {
    return select("app_error_logs", filters);
  },
  getSecurityEvents(filters) {
    return select("security_events", filters);
  },
};
