export interface PrescriptionItem { medicineId: string; medicineName: string; dosage: string; frequency: string; duration: string; }
export interface Prescription { id: string; patientName: string; doctorName: string; createdAt: string; status: "pending" | "dispensed"; items: PrescriptionItem[]; }
