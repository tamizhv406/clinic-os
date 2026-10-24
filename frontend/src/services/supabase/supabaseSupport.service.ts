import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../shared/types/database.types";
import type { SupportTicketRecord } from "../../shared/types/domain";
import type { SupportService } from "../interfaces";
import { supabaseAuthService } from "./supabaseAuth.service";

type TicketRow = Tables<"support_tickets">;

const categories: SupportTicketRecord["category"][] = ["technical", "billing", "whatsapp", "pharmacy"];
const priorities: SupportTicketRecord["priority"][] = ["low", "medium", "high"];

function toTicket(row: TicketRow): SupportTicketRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id ?? "",
    createdByUserId: row.raised_by ?? "",
    category: categories.includes(row.category as SupportTicketRecord["category"]) ? (row.category as SupportTicketRecord["category"]) : "technical",
    priority: priorities.includes(row.priority as SupportTicketRecord["priority"]) ? (row.priority as SupportTicketRecord["priority"]) : "medium",
    status: row.status === "resolved" || row.status === "closed" ? "resolved" : row.status === "in_progress" ? "in_progress" : "open",
    subject: row.subject,
    description: row.description ?? "",
    createdAt: row.created_at ?? undefined,
  };
}

export const supabaseSupportService: SupportService = {
  async getTickets(clinicId) {
    let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (clinicId) query = query.eq("clinic_id", clinicId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toTicket);
  },

  async createTicket(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        clinic_id: input.clinicId || context.clinic_id,
        subject: input.subject,
        category: input.category,
        // The domain model uses low/medium/high; the table stores low/normal/high/urgent.
        priority: input.priority === "medium" ? "normal" : input.priority,
        raised_by: input.createdByUserId || context.staffProfileId,
        status: "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toTicket(data);
  },

  async updateTicketStatus(id, status) {
    const dbStatus = status === "resolved" ? "resolved" : status;
    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status: dbStatus, resolved_at: status === "resolved" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toTicket(data);
  },
};
