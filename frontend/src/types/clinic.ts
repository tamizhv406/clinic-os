export interface Clinic { id: string; name: string; slug: string; specialization: string; address: string; phone: string; hours: string; }
export interface Doctor { id: string; name: string; specialization: string; qualification: string; experience: number; avatar?: string; available: boolean; }
