import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { chartTheme } from "../../../utils/chartTheme";
import type { DoctorPerformanceReport } from "../types";
export function DoctorRevenueChart({ data }: { data: DoctorPerformanceReport[] }) { return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} /><XAxis dataKey="doctorName" /><YAxis /><Tooltip /><Bar dataKey="revenue" fill={chartTheme.teal} /></BarChart></ResponsiveContainer></div>; }
