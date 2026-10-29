import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Calendar, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord, PatientRecord } from "../../../shared/types/domain";
import { DoctorEmptyState } from "../components/DoctorEmptyState";
import { DoctorQueueCard } from "../components/DoctorQueueCard";
import { DoctorStatsGrid } from "../components/DoctorStatsGrid";
import type { DoctorQueueItem, DoctorStats } from "../types";
import { localDateISO, addDaysISO } from "../../../utils/formatDate";

export default function DoctorQueue() {
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");
  const [doctorName, setDoctorName] = useState("");
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [upcomingRange, setUpcomingRange] = useState<"7" | "30" | "custom">("7");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [todayAppointments, setTodayAppointments] = useState<DoctorQueueItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<DoctorQueueItem[]>([]);
  const [allUpcomingCount, setAllUpcomingCount] = useState<number>(0);

  const doctorProfileIdRef = useRef<string | null>(null);

  const getGreeting = (name: string) => {
    const istHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date())
    );
    const greeting = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
    const displayName = name ? (name.startsWith("Dr.") ? name : `Dr. ${name}`) : "Doctor";
    return `${greeting}, ${displayName}`;
  };

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      let doctorId = doctorProfileIdRef.current;
      if (!doctorId) {
        const profile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
        if (!profile) throw new Error("No doctor profile is linked to this staff user.");
        doctorId = profile.id;
        doctorProfileIdRef.current = profile.id;
      }

      setDoctorName(context.fullName || "");
      const clinicObj = context.clinic as { name?: string } | null;
      setClinicName(clinicObj?.name || null);

      const todayStr = localDateISO();
      const endOfToday = todayStr;
      const startOfUpcoming = addDaysISO(todayStr, 1);
      const endOfUpcoming = addDaysISO(todayStr, upcomingRange === "30" ? 30 : 7);

      const targetUpcomingStart = upcomingRange === "custom" && customStartDate ? customStartDate : startOfUpcoming;
      const targetUpcomingEnd = upcomingRange === "custom" && customEndDate ? customEndDate : endOfUpcoming;

      // Query today and upcoming range in parallel with patient join
      const [todayResult, upcomingResult, next7DaysResult] = await Promise.all([
        services.appointments.getDoctorSchedule(doctorId, {
          startDate: todayStr,
          endDate: endOfToday,
        }),
        services.appointments.getDoctorSchedule(doctorId, {
          startDate: targetUpcomingStart,
          endDate: targetUpcomingEnd,
        }),
        services.appointments.getDoctorSchedule(doctorId, {
          startDate: startOfUpcoming,
          endDate: addDaysISO(todayStr, 7),
        }),
      ]);

      const mapItems = (records: AppointmentRecord[], patientMap: Map<string, PatientRecord>) =>
        records
          .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
          .map((appt) => mapQueueItem(appt, patientMap.get(appt.patientId), context.fullName));

      setTodayAppointments(mapItems(todayResult.appointments, todayResult.patients));
      setUpcomingAppointments(mapItems(upcomingResult.appointments, upcomingResult.patients));
      setAllUpcomingCount(next7DaysResult.appointments.filter((a) => a.status !== "cancelled").length);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (error) {
      if (!isSilent) {
        toast.error(error instanceof Error ? error.message : "Unable to load doctor appointments.");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [upcomingRange, customStartDate, customEndDate]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Compute stats strictly from real DB records
  const stats: DoctorStats = useMemo(() => {
    const todayActive = todayAppointments.filter((item) => item.status !== "cancelled");
    const checkedInCount = todayActive.filter((item) => ["arrived", "waiting"].includes(item.status)).length;
    const waitingCount = todayActive.filter((item) => item.status === "waiting").length;
    const inConsultationCount = todayActive.filter((item) => item.status === "in_consultation").length;
    const completedCount = todayActive.filter((item) => item.status === "completed").length;

    return {
      todayTotal: todayActive.length,
      checkedIn: checkedInCount,
      waitingPatients: waitingCount,
      inConsultation: inConsultationCount,
      completedToday: completedCount,
      upcomingThisWeek: allUpcomingCount,
    };
  }, [todayAppointments, allUpcomingCount]);

  // Filter items by search query
  const filterBySearch = useCallback(
    (items: DoctorQueueItem[]) => {
      if (!searchQuery.trim()) return items;
      const q = searchQuery.toLowerCase().trim();
      return items.filter(
        (item) =>
          item.patientName.toLowerCase().includes(q) ||
          (item.phone && item.phone.includes(q)) ||
          (item.token && item.token.toLowerCase().includes(q)) ||
          (item.mainProblem && item.mainProblem.toLowerCase().includes(q))
      );
    },
    [searchQuery]
  );

  const filteredToday = useMemo(() => filterBySearch(todayAppointments), [todayAppointments, filterBySearch]);
  const filteredUpcoming = useMemo(() => filterBySearch(upcomingAppointments), [upcomingAppointments, filterBySearch]);

  // Group upcoming appointments by date
  const upcomingGrouped = useMemo(() => {
    const groups = new Map<string, DoctorQueueItem[]>();
    for (const item of filteredUpcoming) {
      const dateKey = item.appointmentDate || "Upcoming";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(item);
    }
    return Array.from(groups.entries()).map(([dateStr, items]) => {
      let heading = dateStr;
      try {
        const d = new Date(dateStr + "T00:00:00");
        heading = d.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      } catch {
        heading = dateStr;
      }
      return {
        dateStr,
        heading: `${heading} — ${items.length} appointment${items.length === 1 ? "" : "s"}`,
        items: items.sort((a, b) => (a.appointmentTime || "").localeCompare(b.appointmentTime || "")),
      };
    });
  }, [filteredUpcoming]);

  // Live queue slice: patients currently checked in / in consultation
  const liveQueue = useMemo(
    () => todayAppointments.filter((item) => ["arrived", "waiting", "in_consultation"].includes(item.status)),
    [todayAppointments]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={getGreeting(doctorName)}
        description={`${clinicName ? `${clinicName} · ` : ""}Doctor Queue & Schedule`}
        action={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="hidden text-xs text-slate-500 sm:inline">
                Updated at {lastUpdated} IST
              </span>
            )}
            <Button
              icon={<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />}
              loading={loading}
              onClick={() => void loadData()}
              variant="secondary"
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Summary Grid - 100% real database numbers */}
      <DoctorStatsGrid stats={stats} />

      {/* Live Queue Banner if any patients are currently waiting */}
      {liveQueue.length > 0 && activeTab === "today" && (
        <Card className="border-warning-200 bg-warning-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-warning-500"></span>
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-warning-800">
                Live Queue ({liveQueue.length} Checked In)
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {liveQueue.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-warning-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm"
              >
                <span className="font-bold text-brand-700">{item.token}</span>
                <span>{item.patientName}</span>
                {item.status === "in_consultation" && (
                  <span className="rounded bg-brand-100 px-1 text-[10px] text-brand-800">With Doctor</span>
                )}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "today"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="size-4" />
            Today ({todayAppointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "upcoming"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="size-4" />
            Upcoming ({upcomingAppointments.length})
          </button>
        </div>

        {/* Search bar */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search patient, phone, or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Upcoming Range Filter when Upcoming tab is active */}
      {activeTab === "upcoming" && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <span className="text-xs font-semibold text-slate-500">View Range:</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUpcomingRange("7")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                upcomingRange === "7"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Next 7 Days
            </button>
            <button
              type="button"
              onClick={() => setUpcomingRange("30")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                upcomingRange === "30"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Next 30 Days
            </button>
            <button
              type="button"
              onClick={() => setUpcomingRange("custom")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                upcomingRange === "custom"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Custom Dates
            </button>
          </div>

          {upcomingRange === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
          )}
        </Card>
      )}

      {/* Tab 1: Today's Appointments */}
      {activeTab === "today" && (
        <div>
          {filteredToday.length === 0 ? (
            <DoctorEmptyState
              title={searchQuery ? "No matching appointments" : "No appointments scheduled for today"}
              description={
                searchQuery
                  ? "Try checking the spelling or clear your search."
                  : "When patients book online or register at reception, they will appear here."
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredToday.map((item) => (
                <DoctorQueueCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Upcoming Appointments Grouped by Date */}
      {activeTab === "upcoming" && (
        <div className="space-y-6">
          {upcomingGrouped.length === 0 ? (
            <DoctorEmptyState
              title={searchQuery ? "No matching appointments" : `No appointments in the next ${upcomingRange === "30" ? "30" : "7"} days`}
              description={
                searchQuery
                  ? "Try checking the patient name or phone number."
                  : "Upcoming patient bookings will appear here automatically."
              }
            />
          ) : (
            upcomingGrouped.map((group) => (
              <div key={group.dateStr} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Calendar className="size-4 text-brand-700" />
                  <h3 className="font-['Manrope'] text-sm font-bold text-slate-800">{group.heading}</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <DoctorQueueCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function mapQueueItem(
  appointment: AppointmentRecord,
  patient?: PatientRecord | null,
  doctorName = "Doctor"
): DoctorQueueItem {
  return {
    id: appointment.id,
    token: appointment.tokenNumber || "Pending",
    appointmentId: appointment.id,
    tokenNumber: appointment.tokenNumber,
    patientId: appointment.patientId,
    patientName: patient?.fullName ?? "Unknown patient",
    phone: patient?.phone,
    whatsappNumber: patient?.whatsappNumber,
    age: patient?.age ?? 0,
    gender: patient?.gender ?? "other",
    department: appointment.department,
    doctorId: appointment.doctorId,
    doctorName,
    appointmentDate: appointment.date,
    appointmentTime: appointment.time,
    mainProblem: appointment.reason,
    reason: appointment.reason || "Appointment",
    source: appointment.source,
    waitingMinutes: 0,
    previousVisit: false,
    isNewPatient: false,
    tags: [],
    status: (appointment.status as DoctorQueueItem["status"]) || "booked",
  };
}
