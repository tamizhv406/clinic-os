export type MonitoringSeverity = "debug" | "info" | "warning" | "error" | "critical";
export type MonitoringStatus = "success" | "failed" | "queued" | "running" | "ok" | "degraded" | "down" | "open" | "recorded" | "resolved" | "ignored";

export type MonitoringFilters = {
  clinicId?: string;
  dateFrom?: string;
  dateTo?: string;
  module?: string;
  status?: string;
  severity?: MonitoringSeverity;
  limit?: number;
};

export type MonitoringLogInput = {
  clinicId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  actorRole?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  status?: string;
  severity?: MonitoringSeverity;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

export type MonitoringLog = Required<Pick<MonitoringLogInput, "eventType">> & {
  id: string;
  clinicId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  status?: string | null;
  severity?: MonitoringSeverity | string | null;
  message?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SystemHealthLog = MonitoringLog & { status: string };

export interface MonitoringService {
  logAuditEvent(input: MonitoringLogInput): Promise<void>;
  logSecurityEvent(input: MonitoringLogInput): Promise<void>;
  logAppError(input: MonitoringLogInput): Promise<void>;
  logHealthCheck(input: MonitoringLogInput): Promise<void>;
  getAuditLogs(filters?: MonitoringFilters): Promise<MonitoringLog[]>;
  getSystemHealth(filters?: MonitoringFilters): Promise<SystemHealthLog[]>;
  getErrorLogs(filters?: MonitoringFilters): Promise<MonitoringLog[]>;
  getSecurityEvents(filters?: MonitoringFilters): Promise<MonitoringLog[]>;
}
