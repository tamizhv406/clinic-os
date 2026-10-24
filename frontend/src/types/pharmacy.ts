export interface Medicine { id: string; name: string; category: string; stock: number; reorderLevel: number; expiry: string; price: number; }
export interface PharmacyBill { id: string; patientName: string; amount: number; paymentStatus: "paid" | "pending"; createdAt: string; }
