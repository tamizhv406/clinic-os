import type { MonitoringLogInput } from "../interfaces";
import { supabaseMonitoringService } from "./supabaseMonitoring.service";

export function logAuditEvent(input: MonitoringLogInput) {
  void supabaseMonitoringService.logAuditEvent(input).catch(() => undefined);
}

export function logSecurityEvent(input: MonitoringLogInput) {
  void supabaseMonitoringService.logSecurityEvent(input).catch(() => undefined);
}

export function logAppError(input: MonitoringLogInput) {
  void supabaseMonitoringService.logAppError(input).catch(() => undefined);
}

export function logHealthCheck(input: MonitoringLogInput) {
  void supabaseMonitoringService.logHealthCheck(input).catch(() => undefined);
}
