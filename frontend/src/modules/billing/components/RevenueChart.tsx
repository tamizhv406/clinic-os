import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { chartTheme } from "../../../utils/chartTheme";
export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) { return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Area type="monotone" dataKey="revenue" stroke={chartTheme.teal} fill={chartTheme.fill} /></AreaChart></ResponsiveContainer></div>; }
