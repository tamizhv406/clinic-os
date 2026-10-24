export type PaymentStatus = "paid" | "pending" | "partially_paid" | "refunded";
export interface Invoice { id: string; patientName: string; amount: number; status: PaymentStatus; date: string; }
export interface Payment { id: string; patientName: string; amount: number; mode: "UPI" | "Cash" | "Card"; status: PaymentStatus; time: string; }
