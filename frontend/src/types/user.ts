export type UserRole = "owner" | "admin" | "receptionist" | "doctor" | "pharmacist" | "super_admin";
export interface User { id: string; name: string; email: string; role: UserRole; clinicId?: string; }
