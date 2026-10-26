export type UserRole = 'patient' | 'nurse' | 'doctor';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  specialty?: string; // For doctors
  licenseNumber?: string; // For doctors / nurses
  department?: string; // For staff / doctors
  dob?: string; // For patients
  bloodGroup?: string; // For patients
  emergencyContact?: string; // For patients
  allergies?: string[]; // For patients
  createdAt: string;
}

export type AcuityLevel = 1 | 2 | 3 | 4 | 5;
// ESI 1: Resuscitation (Immediate life-saving intervention)
// ESI 2: Emergent (High risk, confused/lethargic/severe pain)
// ESI 3: Urgent (Multiple resources required, vitals stable)
// ESI 4: Less Urgent (One resource required)
// ESI 5: Non-Urgent (No resources required)

export interface VitalSigns {
  heartRate: number; // bpm
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  o2Sat: number; // % SpO2
  temperature: number; // °F or °C
  respRate: number; // breaths/min
  painScore: number; // 0 - 10
  consciousness: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  recordedAt: string;
}

export type PatientStatus =
  | 'waiting'
  | 'in_triage'
  | 'assigned_bed'
  | 'with_doctor'
  | 'admitted'
  | 'discharged';

export interface PatientRecord {
  id: string;
  mrn: string; // Medical Record Number e.g. PC-2026-XXXXX
  userId?: string; // Linked patient user account if exists
  fullName: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  arrivalMode: 'walk_in' | 'ambulance' | 'wheelchair' | 'transfer';
  chiefComplaint: string;
  allergies: string[];
  medicalHistory: string[];
  currentVitals: VitalSigns;
  vitalsHistory: VitalSigns[];
  acuityLevel: AcuityLevel;
  mewsScore: number; // Modified Early Warning Score
  triageTime: string;
  status: PatientStatus;
  assignedBedId?: string;
  assignedBedName?: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  triageNotes?: string;
  aiTriageAssessment?: {
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    detectedAnomalies: string[];
    hiddenRisks: string[];
    recommendedInterventions: string[];
    rationale: string;
  };
  priorityScore: number; // Heap priority score
  createdAt: string;
  updatedAt: string;
}

export interface Bed {
  id: string;
  number: string;
  name: string;
  type: 'trauma' | 'rapid_care' | 'pediatric' | 'observation';
  status: 'available' | 'occupied' | 'cleaning' | 'reserved';
  patientId?: string;
  patientName?: string;
  patientAcuity?: AcuityLevel;
  assignedAt?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  dateTime: string;
  reason: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  createdAt: string;
}

export interface PrescriptionAdherenceLog {
  date: string;
  taken: boolean;
  slotIndex?: number;
  slotName?: string;
  takenAt?: string;
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  sideEffects?: string;
  precautions?: string;
  adherenceLogs?: PrescriptionAdherenceLog[];
}

export interface DoctorClinicalNote {
  id: string;
  patientId: string;
  patientMrn: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  differentialDiagnoses: string[];
  dischargeInstructions: string;
  prescriptions: PrescriptionItem[];
  status: 'draft' | 'signed';
  signedAt: string;
  createdAt: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientMrn: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  testName: string;
  category: 'hematology' | 'chemistry' | 'cardiac' | 'imaging' | 'urinalysis' | 'microbiology';
  priority: 'STAT' | 'Urgent' | 'Routine';
  status: 'ordered' | 'in_progress' | 'completed';
  orderedAt: string;
  result?: string;
  resultedAt?: string;
  normalRange?: string;
  abnormalFlag?: boolean;
}

export interface AILog {
  id: string;
  patientId?: string;
  userId: string;
  type: 'symptom_check' | 'triage_validation' | 'clinical_cds' | 'medical_note' | 'health_summary';
  input: any;
  output: any;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface AuthSession {
  token: string;
  user: User;
  loginAt: string;
  expiresAt?: string;
}

export interface PatientVitalRecord {
  id: string;
  timestamp: string;
  dateLabel: string;
  timeLabel: string;
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  o2Sat: number;
  temperature: number;
  bloodSugar: number;
  respRate: number;
  source: 'hospital' | 'patient_log' | 'wearable';
  status: 'optimal' | 'elevated' | 'high' | 'low';
  notes?: string;
}
