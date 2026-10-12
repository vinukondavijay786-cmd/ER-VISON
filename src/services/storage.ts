import {
  User,
  PatientRecord,
  Bed,
  Appointment,
  DoctorClinicalNote,
  PrescriptionItem,
  LabOrder,
  AILog,
  AuthSession,
  AcuityLevel,
  VitalSigns,
} from '../types';

const STORAGE_KEYS = {
  USERS: 'pulsecare_users',
  PATIENTS: 'pulsecare_patients',
  BEDS: 'pulsecare_beds',
  APPOINTMENTS: 'pulsecare_appointments',
  CLINICAL_NOTES: 'pulsecare_clinical_notes',
  LAB_ORDERS: 'pulsecare_lab_orders',
  AI_LOGS: 'pulsecare_ai_logs',
  SESSION: 'pulsecare_session',
  PASSWORD_RESETS: 'pulsecare_password_resets',
};

// Helper: SHA-256 password hash using standard browser Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + '_pulsecare_secure_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Calculate Modified Early Warning Score (MEWS)
export function calculateMEWS(vitals: VitalSigns): number {
  let score = 0;

  // Systolic BP (mmHg)
  if (vitals.systolicBP <= 70) score += 3;
  else if (vitals.systolicBP <= 80) score += 2;
  else if (vitals.systolicBP <= 100) score += 1;
  else if (vitals.systolicBP >= 200) score += 2;

  // Heart Rate (bpm)
  if (vitals.heartRate <= 40) score += 2;
  else if (vitals.heartRate <= 50) score += 1;
  else if (vitals.heartRate >= 130) score += 3;
  else if (vitals.heartRate >= 111) score += 2;
  else if (vitals.heartRate >= 101) score += 1;

  // Respiratory Rate (breaths/min)
  if (vitals.respRate < 9) score += 2;
  else if (vitals.respRate >= 30) score += 3;
  else if (vitals.respRate >= 21) score += 2;
  else if (vitals.respRate >= 15) score += 1;

  // Temperature (°F)
  if (vitals.temperature < 95) score += 2;
  else if (vitals.temperature >= 101.5) score += 2;
  else if (vitals.temperature >= 100.4) score += 1;

  // Consciousness (AVPU)
  if (vitals.consciousness === 'Voice') score += 1;
  else if (vitals.consciousness === 'Pain') score += 2;
  else if (vitals.consciousness === 'Unresponsive') score += 3;

  return score;
}

// Acuity Priority Heap calculation
export function calculatePriorityScore(
  acuityLevel: AcuityLevel,
  triageTime: string,
  mewsScore: number
): number {
  const acuityWeights: Record<AcuityLevel, number> = {
    1: 10000, // Immediate resuscitation
    2: 5000,  // Emergent
    3: 2000,  // Urgent
    4: 800,   // Less urgent
    5: 200,   // Non-urgent
  };

  const waitMinutes = Math.max(
    0,
    (Date.now() - new Date(triageTime).getTime()) / (1000 * 60)
  );

  // Time weight increases urgency as patient waits, but acuity weight remains primary
  const timeWeight = waitMinutes * 3.5;
  const mewsWeight = mewsScore * 120;

  return Math.round(acuityWeights[acuityLevel] + timeWeight + mewsWeight);
}

// Default hospital ER bays
function getDefaultHospitalBeds(): Bed[] {
  return [
    { id: 'bed-t1', number: 'Bay 1', name: 'Trauma Resuscitation 1', type: 'trauma', status: 'occupied', patientId: 'pt_robert_miller', patientName: 'Robert Miller', patientAcuity: 2 },
    { id: 'bed-t2', number: 'Bay 2', name: 'Trauma Resuscitation 2', type: 'trauma', status: 'available' },
    { id: 'bed-rc1', number: 'Bay 3', name: 'Rapid Care Unit 1', type: 'rapid_care', status: 'occupied', patientId: 'pt_david_morales', patientName: 'David Morales', patientAcuity: 2 },
    { id: 'bed-rc2', number: 'Bay 4', name: 'Rapid Care Unit 2', type: 'rapid_care', status: 'available' },
    { id: 'bed-rc3', number: 'Bay 5', name: 'Rapid Care Unit 3', type: 'rapid_care', status: 'available' },
    { id: 'bed-rc4', number: 'Bay 6', name: 'Rapid Care Unit 4', type: 'rapid_care', status: 'cleaning' },
    { id: 'bed-p1', number: 'Bay 7', name: 'Pediatric Bay A', type: 'pediatric', status: 'available' },
    { id: 'bed-p2', number: 'Bay 8', name: 'Pediatric Bay B', type: 'pediatric', status: 'available' },
    { id: 'bed-ob1', number: 'Obs 1', name: 'Clinical Observation 1', type: 'observation', status: 'available' },
    { id: 'bed-ob2', number: 'Obs 2', name: 'Clinical Observation 2', type: 'observation', status: 'available' },
    { id: 'bed-ob3', number: 'Obs 3', name: 'Clinical Observation 3', type: 'observation', status: 'available' },
    { id: 'bed-ob4', number: 'Obs 4', name: 'Clinical Observation 4', type: 'observation', status: 'available' },
  ];
}

function getDefaultUsers(): User[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'usr_doc_elena',
      name: 'Dr. Elena Rostova, MD',
      email: 'elena.doctor@ervision.health',
      passwordHash: 'demo_hash_ervision',
      role: 'doctor',
      phone: '(555) 301-4402',
      specialty: 'Emergency Medicine & Trauma',
      licenseNumber: 'MD-49821',
      department: 'Department of Emergency Medicine',
      createdAt: now,
    },
    {
      id: 'usr_doc_marcus',
      name: 'Dr. Michael Marcus, MD',
      email: 'marcus.cardio@ervision.health',
      passwordHash: 'demo_hash_ervision',
      role: 'doctor',
      phone: '(555) 301-4403',
      specialty: 'Interventional Cardiology',
      licenseNumber: 'MD-51209',
      department: 'Cardiac Care Unit',
      createdAt: now,
    },
    {
      id: 'usr_doc_priya',
      name: 'Dr. Priya Patel, MD',
      email: 'priya.internal@ervision.health',
      passwordHash: 'demo_hash_ervision',
      role: 'doctor',
      phone: '(555) 301-4404',
      specialty: 'Internal Medicine & Critical Care',
      licenseNumber: 'MD-63012',
      department: 'Intensive Care Division',
      createdAt: now,
    },
    {
      id: 'usr_nurse_marcus',
      name: 'Marcus Vance, RN',
      email: 'marcus.nurse@ervision.health',
      passwordHash: 'demo_hash_ervision',
      role: 'nurse',
      phone: '(555) 301-5510',
      department: 'Emergency Department - Triage Center',
      licenseNumber: 'RN-74892',
      createdAt: now,
    },
    {
      id: 'usr_patient_sarah',
      name: 'Sarah Connor',
      email: 'sarah.patient@ervision.health',
      passwordHash: 'demo_hash_ervision',
      role: 'patient',
      phone: '(555) 234-8901',
      dob: '1992-04-18',
      bloodGroup: 'O+',
      emergencyContact: '(555) 234-8901',
      allergies: ['Penicillin (Hives)', 'Sulfa (Mild rash)'],
      createdAt: now,
    },
  ];
}

function getDefaultPatients(): PatientRecord[] {
  const now = new Date();
  const t1 = new Date(now.getTime() - 24 * 60 * 1000).toISOString();
  const t2 = new Date(now.getTime() - 12 * 60 * 1000).toISOString();
  const t3 = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const t4 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const v1: VitalSigns = {
    heartRate: 108,
    systolicBP: 146,
    diastolicBP: 92,
    o2Sat: 94,
    temperature: 98.6,
    respRate: 22,
    painScore: 8,
    consciousness: 'Alert',
    recordedAt: t1,
  };
  const v2: VitalSigns = {
    heartRate: 128,
    systolicBP: 84,
    diastolicBP: 50,
    o2Sat: 90,
    temperature: 102.8,
    respRate: 28,
    painScore: 4,
    consciousness: 'Voice',
    recordedAt: t2,
  };
  const v3: VitalSigns = {
    heartRate: 114,
    systolicBP: 132,
    diastolicBP: 86,
    o2Sat: 89,
    temperature: 98.8,
    respRate: 26,
    painScore: 3,
    consciousness: 'Alert',
    recordedAt: t3,
  };
  const v4: VitalSigns = {
    heartRate: 72,
    systolicBP: 120,
    diastolicBP: 78,
    o2Sat: 99,
    temperature: 98.4,
    respRate: 16,
    painScore: 2,
    consciousness: 'Alert',
    recordedAt: t4,
  };

  const mews1 = calculateMEWS(v1);
  const mews2 = calculateMEWS(v2);
  const mews3 = calculateMEWS(v3);
  const mews4 = calculateMEWS(v4);

  return [
    {
      id: 'pt_robert_miller',
      mrn: 'PC-2026-88102',
      fullName: 'Robert Miller',
      dob: '1968-11-20',
      gender: 'male',
      arrivalMode: 'ambulance',
      chiefComplaint: 'Crushing substernal chest pressure for 45 min, diaphoresis, radiating to left jaw',
      allergies: ['Aspirin (Mild GI)'],
      medicalHistory: ['CAD', 'Hyperlipidemia', 'Hypertension'],
      triageNotes: 'Patient diaphoretic, clutching chest. 12-lead ECG indicated immediately. Bedded in Trauma Bay 1.',
      triageTime: t1,
      acuityLevel: 2,
      currentVitals: v1,
      vitalsHistory: [v1],
      mewsScore: mews1,
      priorityScore: calculatePriorityScore(2, t1, mews1),
      status: 'assigned_bed',
      assignedBedId: 'bed-t1',
      assignedBedName: 'Bay 1 - Trauma Resuscitation 1',
      createdAt: t1,
      updatedAt: t1,
    },
    {
      id: 'pt_evelyn_chen',
      mrn: 'PC-2026-92140',
      fullName: 'Evelyn Chen',
      dob: '1954-03-12',
      gender: 'female',
      arrivalMode: 'ambulance',
      chiefComplaint: 'High fever, rigors, lethargy, productive cough, confusion onset 6 hours ago',
      allergies: ['Penicillin (Anaphylaxis)'],
      medicalHistory: ['Type 2 Diabetes', 'COPD'],
      triageNotes: 'Meets SIRS criteria with hypotension. Shock index 1.52. Sepsis resuscitation bundle required stat.',
      triageTime: t2,
      acuityLevel: 1,
      currentVitals: v2,
      vitalsHistory: [v2],
      mewsScore: mews2,
      priorityScore: calculatePriorityScore(1, t2, mews2),
      status: 'waiting',
      createdAt: t2,
      updatedAt: t2,
    },
    {
      id: 'pt_david_morales',
      mrn: 'PC-2026-74319',
      fullName: 'David Morales',
      dob: '2001-08-04',
      gender: 'male',
      arrivalMode: 'walk_in',
      chiefComplaint: 'Acute wheezing and shortness of breath unresponsive to rescue albuterol inhaler',
      allergies: ['Peanuts', 'Sulfa'],
      medicalHistory: ['Severe Asthma'],
      triageNotes: 'Accessory muscle use observed. Titrating high-flow O2 and nebulizer therapy in Bay 3.',
      triageTime: t3,
      acuityLevel: 2,
      currentVitals: v3,
      vitalsHistory: [v3],
      mewsScore: mews3,
      priorityScore: calculatePriorityScore(2, t3, mews3),
      status: 'assigned_bed',
      assignedBedId: 'bed-rc1',
      assignedBedName: 'Bay 3 - Rapid Care Unit 1',
      createdAt: t3,
      updatedAt: t3,
    },
    {
      id: 'pt_sarah_connor',
      mrn: 'PC-2026-10492',
      userId: 'usr_patient_sarah',
      fullName: 'Sarah Connor',
      dob: '1992-04-18',
      gender: 'female',
      arrivalMode: 'walk_in',
      chiefComplaint: 'Mild recurring temporal headaches and sinus congestion for 4 days',
      allergies: ['Penicillin (Hives)'],
      medicalHistory: ['Seasonal Allergies'],
      triageNotes: 'Vitals stable. Alert and oriented x4. Awaiting outpatient consultation.',
      triageTime: t4,
      acuityLevel: 4,
      currentVitals: v4,
      vitalsHistory: [v4],
      mewsScore: mews4,
      priorityScore: calculatePriorityScore(4, t4, mews4),
      status: 'waiting',
      createdAt: t4,
      updatedAt: t4,
    },
  ];
}

function getDefaultClinicalNotes(): DoctorClinicalNote[] {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'note_sarah_initial',
      patientId: 'usr_patient_sarah',
      patientMrn: 'PC-2026-10492',
      patientName: 'Sarah Connor',
      doctorId: 'usr_doc_elena',
      doctorName: 'Dr. Elena Rostova, MD',
      specialty: 'Emergency Medicine & Trauma',
      subjective:
        'Patient reports 4-day history of bilateral frontotemporal head pressure, nasal congestion, and mild facial fullness. Denies visual changes, neck stiffness, fever, or trauma.',
      objective:
        'Alert, oriented x4 in no acute distress. Pupils equal and reactive. Cranial nerves II-XII intact. Maxillary sinus tenderness mildly positive. Oropharynx clear. Heart regular rhythm, lungs clear to auscultation bilaterally. BP 120/78, HR 72, SpO2 99%.',
      assessment:
        'Acute Maxillary Sinusitis & Tension Cephalea. No red flags for intracranial pathology.',
      plan:
        '1. Saline nasal irrigation BID.\n2. Prescribed Amoxicillin-Clavulanate 875/125 mg BID for 7 days.\n3. Prescribed Lisinopril 10 mg daily for blood pressure optimization.\n4. Encourage adequate oral hydration and rest.',
      differentialDiagnoses: ['Acute Sinusitis', 'Tension Headache', 'Allergic Rhinitis'],
      dischargeInstructions:
        'Complete full 7-day antibiotic course even if feeling better. Drink 2-3 liters of fluids daily. Seek immediate emergency evaluation if you develop high fever, stiff neck, confusion, or visual changes.',
      prescriptions: [
        {
          id: 'rx_amox_sarah',
          medication: 'Amoxicillin-Clavulanate (Augmentin)',
          dosage: '875/125 mg',
          frequency: 'Twice daily with meals',
          route: 'Oral',
          duration: '7 days',
          instructions: 'Take with food to prevent stomach upset. Finish complete course.',
          precautions: 'Report severe watery diarrhea or allergic rash immediately.',
          adherenceLogs: [],
        },
        {
          id: 'rx_lisinopril_sarah',
          medication: 'Lisinopril',
          dosage: '10 mg',
          frequency: 'Once daily in the morning',
          route: 'Oral',
          duration: '30 days',
          instructions: 'Take once each morning with water. Monitor blood pressure weekly.',
          precautions: 'Report dry persistent cough or lip/facial swelling immediately.',
          adherenceLogs: [],
        },
      ],
      status: 'signed',
      signedAt: pastDate,
      createdAt: pastDate,
    },
  ];
}

function getDefaultLabOrders(): LabOrder[] {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString();

  return [
    {
      id: 'ord_sarah_trop',
      patientId: 'usr_patient_sarah',
      patientMrn: 'PC-2026-10492',
      patientName: 'Sarah Connor',
      doctorId: 'usr_doc_elena',
      doctorName: 'Dr. Elena Rostova, MD',
      testName: 'High-Sensitivity Troponin I (hs-cTnI)',
      category: 'cardiac',
      priority: 'Routine',
      status: 'completed',
      result: '< 0.01 ng/mL (Normal myocardial baseline)',
      normalRange: '< 0.04 ng/mL',
      orderedAt: pastDate,
      resultedAt: pastDate,
    },
    {
      id: 'ord_robert_trop',
      patientId: 'pt_robert_miller',
      patientMrn: 'PC-2026-88102',
      patientName: 'Robert Miller',
      doctorId: 'usr_doc_elena',
      doctorName: 'Dr. Elena Rostova, MD',
      testName: 'STAT High-Sensitivity Troponin I & 12-Lead ECG',
      category: 'cardiac',
      priority: 'STAT',
      status: 'ordered',
      orderedAt: today,
    },
    {
      id: 'ord_evelyn_lactate',
      patientId: 'pt_evelyn_chen',
      patientMrn: 'PC-2026-92140',
      patientName: 'Evelyn Chen',
      doctorId: 'usr_doc_elena',
      doctorName: 'Dr. Elena Rostova, MD',
      testName: 'STAT Serum Lactate, Blood Cultures x2 & CBC',
      category: 'hematology',
      priority: 'STAT',
      status: 'ordered',
      orderedAt: today,
    },
  ];
}

function getDefaultAppointments(): Appointment[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const dateStr = tomorrow.toISOString().split('T')[0];

  return [
    {
      id: 'apt_sarah_cardio',
      patientId: 'usr_patient_sarah',
      patientName: 'Sarah Connor',
      patientEmail: 'sarah.patient@ervision.health',
      doctorId: 'usr_doc_marcus',
      doctorName: 'Dr. Michael Marcus, MD',
      specialty: 'Interventional Cardiology',
      dateTime: `${dateStr} at 10:30 AM`,
      reason: 'Preventive cardiovascular risk screening and BP check',
      notes: 'Please bring recent blood pressure logs.',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    },
  ];
}

class StorageManager {
  // Users
  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      const defaults = getDefaultUsers();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  }

  saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  findUserByEmail(email: string): User | undefined {
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  }

  // Session
  getSession(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  }

  setSession(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  // Patients
  getPatients(): PatientRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    let patients: PatientRecord[];
    if (!raw) {
      patients = getDefaultPatients();
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } else {
      patients = JSON.parse(raw);
    }
    // Recalculate priority scores based on current elapsed waiting time
    return patients.map((p) => ({
      ...p,
      priorityScore: calculatePriorityScore(p.acuityLevel, p.triageTime, p.mewsScore),
    }));
  }

  savePatient(patient: PatientRecord): void {
    const patients = this.getPatients();
    const index = patients.findIndex((p) => p.id === patient.id);
    if (index >= 0) {
      patients[index] = patient;
    } else {
      patients.push(patient);
    }
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }

  getPatientById(id: string): PatientRecord | undefined {
    return this.getPatients().find((p) => p.id === id);
  }

  getPatientByMrn(mrn: string): PatientRecord | undefined {
    return this.getPatients().find((p) => p.mrn.toUpperCase() === mrn.toUpperCase());
  }

  // Hospital Beds
  getBeds(): Bed[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BEDS);
    if (!raw) {
      const defaultBeds = getDefaultHospitalBeds();
      localStorage.setItem(STORAGE_KEYS.BEDS, JSON.stringify(defaultBeds));
      return defaultBeds;
    }
    return JSON.parse(raw);
  }

  saveBeds(beds: Bed[]): void {
    localStorage.setItem(STORAGE_KEYS.BEDS, JSON.stringify(beds));
  }

  assignBed(bedId: string, patient: PatientRecord): Bed | null {
    const beds = this.getBeds();
    const bedIndex = beds.findIndex((b) => b.id === bedId);
    if (bedIndex === -1) return null;

    // Free any previously assigned bed for this patient
    beds.forEach((b) => {
      if (b.patientId === patient.id) {
        b.status = 'cleaning';
        delete b.patientId;
        delete b.patientName;
        delete b.patientAcuity;
        delete b.assignedAt;
      }
    });

    const targetBed = beds[bedIndex];
    targetBed.status = 'occupied';
    targetBed.patientId = patient.id;
    targetBed.patientName = patient.fullName;
    targetBed.patientAcuity = patient.acuityLevel;
    targetBed.assignedAt = new Date().toISOString();

    this.saveBeds(beds);

    // Update patient record
    patient.assignedBedId = targetBed.id;
    patient.assignedBedName = `${targetBed.number} - ${targetBed.name}`;
    if (patient.status === 'waiting' || patient.status === 'in_triage') {
      patient.status = 'assigned_bed';
    }
    patient.updatedAt = new Date().toISOString();
    this.savePatient(patient);

    return targetBed;
  }

  releaseBed(bedId: string): void {
    const beds = this.getBeds();
    const bed = beds.find((b) => b.id === bedId);
    if (bed) {
      const patientId = bed.patientId;
      bed.status = 'cleaning';
      delete bed.patientId;
      delete bed.patientName;
      delete bed.patientAcuity;
      delete bed.assignedAt;
      this.saveBeds(beds);

      if (patientId) {
        const patient = this.getPatientById(patientId);
        if (patient) {
          delete patient.assignedBedId;
          delete patient.assignedBedName;
          patient.updatedAt = new Date().toISOString();
          this.savePatient(patient);
        }
      }
    }
  }

  setBedStatus(bedId: string, status: 'available' | 'occupied' | 'cleaning' | 'reserved'): void {
    const beds = this.getBeds();
    const bed = beds.find((b) => b.id === bedId);
    if (bed) {
      bed.status = status;
      if (status === 'available' || status === 'cleaning') {
        delete bed.patientId;
        delete bed.patientName;
        delete bed.patientAcuity;
        delete bed.assignedAt;
      }
      this.saveBeds(beds);
    }
  }

  // Appointments
  getAppointments(): Appointment[] {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (!raw) {
      const defaults = getDefaultAppointments();
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  }

  saveAppointment(appointment: Appointment): void {
    const appointments = this.getAppointments();
    const index = appointments.findIndex((a) => a.id === appointment.id);
    if (index >= 0) {
      appointments[index] = appointment;
    } else {
      appointments.push(appointment);
    }
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }

  // Clinical Notes & Prescriptions
  getClinicalNotes(): DoctorClinicalNote[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLINICAL_NOTES);
    if (!raw) {
      const defaults = getDefaultClinicalNotes();
      localStorage.setItem(STORAGE_KEYS.CLINICAL_NOTES, JSON.stringify(defaults));
      return defaults;
    }
    try {
      const rawNotes: DoctorClinicalNote[] = JSON.parse(raw);
      const uniqueNotes: DoctorClinicalNote[] = [];
      const seenEncounterKeys = new Set<string>();
      const seenRxIds = new Set<string>();
      let needsResave = false;

      // Sort most recent first
      const sortedRaw = [...rawNotes].sort(
        (a, b) =>
          new Date(b.signedAt || b.createdAt).getTime() -
          new Date(a.signedAt || a.createdAt).getTime()
      );

      sortedRaw.forEach((note) => {
        // Form a canonical deduplication key for clinical encounter records
        const pKey = (note.patientName || note.patientId || '')
          .toLowerCase()
          .replace(/^(usr_patient_|pt_)/, '')
          .replace(/[^a-z0-9]/g, '');

        const diagRoot = (note.assessment || note.subjective || 'consultation')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 2)
          .join('_') || 'encounter';

        const encounterSignature = `${pKey}_${diagRoot}`;

        if (!seenEncounterKeys.has(encounterSignature)) {
          seenEncounterKeys.add(encounterSignature);

          // Deduplicate prescriptions inside this note so each medication is listed only once
          if (note.prescriptions && Array.isArray(note.prescriptions)) {
            const uniqueRx: PrescriptionItem[] = [];
            const seenRxRoots = new Set<string>();

            note.prescriptions.forEach((rx, idx) => {
              const medRoot = (rx.medication || '')
                .toLowerCase()
                .replace(/\(.*?\)/g, '')
                .replace(/\b\d+(\.\d+)?(\/\d+)?\s*(mg|mcg|ml|g|%)\b/gi, '')
                .replace(/[^a-z0-9]/g, ' ')
                .trim()
                .split(/\s+/)[0] || (rx.medication || '').toLowerCase().trim();

              if (medRoot && !seenRxRoots.has(medRoot)) {
                seenRxRoots.add(medRoot);
                if (!rx.id || seenRxIds.has(rx.id)) {
                  rx.id = `rx_${note.id}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
                  needsResave = true;
                }
                seenRxIds.add(rx.id);
                uniqueRx.push(rx);
              } else {
                needsResave = true;
              }
            });
            note.prescriptions = uniqueRx;
          }

          uniqueNotes.push(note);
        } else {
          // Duplicate note encountered - prune it
          needsResave = true;
        }
      });

      if (needsResave) {
        localStorage.setItem(STORAGE_KEYS.CLINICAL_NOTES, JSON.stringify(uniqueNotes));
      }
      return uniqueNotes;
    } catch {
      return getDefaultClinicalNotes();
    }
  }

  saveClinicalNote(note: DoctorClinicalNote): void {
    const notes = this.getClinicalNotes();
    const pKey = (note.patientName || note.patientId || '')
      .toLowerCase()
      .replace(/^(usr_patient_|pt_)/, '')
      .replace(/[^a-z0-9]/g, '');

    const diagRoot = (note.assessment || note.subjective || 'consultation')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 2)
      .join('_') || 'encounter';

    const index = notes.findIndex((n) => {
      if (n.id === note.id) return true;
      const curPKey = (n.patientName || n.patientId || '')
        .toLowerCase()
        .replace(/^(usr_patient_|pt_)/, '')
        .replace(/[^a-z0-9]/g, '');
      const curDiag = (n.assessment || n.subjective || 'consultation')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 2)
        .join('_') || 'encounter';

      return curPKey === pKey && (curDiag === diagRoot || n.doctorId === note.doctorId);
    });

    if (index >= 0) {
      notes[index] = { ...notes[index], ...note, id: notes[index].id };
    } else {
      notes.push(note);
    }
    this.saveClinicalNotes(notes);
  }

  saveClinicalNotes(notes: DoctorClinicalNote[]): void {
    localStorage.setItem(STORAGE_KEYS.CLINICAL_NOTES, JSON.stringify(notes));
  }

  updatePrescriptionSlotAdherence(
    patientId: string,
    medId: string,
    date: string,
    slotIndex: number,
    slotName: string,
    taken: boolean,
    takenAt?: string
  ): void {
    const notes = this.getClinicalNotes();
    let noteUpdated = false;

    for (const note of notes) {
      if (note.prescriptions) {
        const med = note.prescriptions.find((p) => p.id === medId);
        if (med) {
          if (!med.adherenceLogs) med.adherenceLogs = [];
          const logIdx = med.adherenceLogs.findIndex(
            (l) => l.date === date && (l.slotIndex ?? 0) === slotIndex
          );
          if (logIdx >= 0) {
            med.adherenceLogs[logIdx].taken = taken;
            med.adherenceLogs[logIdx].slotName = slotName;
            med.adherenceLogs[logIdx].takenAt = taken
              ? takenAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : undefined;
          } else {
            med.adherenceLogs.push({
              date,
              slotIndex,
              slotName,
              taken,
              takenAt: taken
                ? takenAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : undefined,
            });
          }
          noteUpdated = true;
          break;
        }
      }
    }

    if (noteUpdated) {
      this.saveClinicalNotes(notes);
    }
  }

  getClinicalNotesByPatient(patientId: string): DoctorClinicalNote[] {
    const pIdClean = patientId.toLowerCase().replace(/^(usr_patient_|pt_)/, '').trim();
    return this.getClinicalNotes().filter((n) => {
      const nIdClean = (n.patientId || '').toLowerCase().replace(/^(usr_patient_|pt_)/, '').trim();
      const nName = (n.patientName || '').toLowerCase().trim();
      return nIdClean === pIdClean || (nName && pIdClean.length > 2 && nName.includes(pIdClean));
    });
  }

  // Lab & Treatment Orders
  getLabOrders(): LabOrder[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LAB_ORDERS);
    if (!raw) {
      const defaults = getDefaultLabOrders();
      localStorage.setItem(STORAGE_KEYS.LAB_ORDERS, JSON.stringify(defaults));
      return defaults;
    }
    try {
      const rawOrders: LabOrder[] = JSON.parse(raw);
      const uniqueOrders: LabOrder[] = [];
      const seenLabKeys = new Set<string>();
      let needsResave = false;

      // Sort completed results first, then latest
      const sorted = [...rawOrders].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return -1;
        if (b.status === 'completed' && a.status !== 'completed') return 1;
        return new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime();
      });

      sorted.forEach((ord) => {
        const pKey = (ord.patientName || ord.patientId || '')
          .toLowerCase()
          .replace(/^(usr_patient_|pt_)/, '')
          .replace(/[^a-z0-9]/g, '');
        const testKey = ord.testName
          .toLowerCase()
          .replace(/stat|\&|12-lead|high-sensitivity|hs-ctni|troponin/gi, 'troponin')
          .replace(/[^a-z0-9]/g, '')
          .trim();
        const labSig = `${pKey}_${testKey}`;

        if (!seenLabKeys.has(labSig)) {
          seenLabKeys.add(labSig);
          uniqueOrders.push(ord);
        } else {
          needsResave = true;
        }
      });

      if (needsResave) {
        localStorage.setItem(STORAGE_KEYS.LAB_ORDERS, JSON.stringify(uniqueOrders));
      }
      return uniqueOrders;
    } catch {
      return getDefaultLabOrders();
    }
  }

  saveLabOrder(order: LabOrder): void {
    const orders = this.getLabOrders();
    const pKey = (order.patientName || order.patientId || '')
      .toLowerCase()
      .replace(/^(usr_patient_|pt_)/, '')
      .replace(/[^a-z0-9]/g, '');
    const testKey = order.testName
      .toLowerCase()
      .replace(/stat|\&|12-lead|high-sensitivity|hs-ctni|troponin/gi, 'troponin')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    const index = orders.findIndex((o) => {
      if (o.id === order.id) return true;
      const curPKey = (o.patientName || o.patientId || '')
        .toLowerCase()
        .replace(/^(usr_patient_|pt_)/, '')
        .replace(/[^a-z0-9]/g, '');
      const curTest = o.testName
        .toLowerCase()
        .replace(/stat|\&|12-lead|high-sensitivity|hs-ctni|troponin/gi, 'troponin')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      return curPKey === pKey && curTest === testKey;
    });

    if (index >= 0) {
      orders[index] = { ...orders[index], ...order, id: orders[index].id };
    } else {
      orders.push(order);
    }
    localStorage.setItem(STORAGE_KEYS.LAB_ORDERS, JSON.stringify(orders));
  }

  getLabOrdersByPatient(patientId: string): LabOrder[] {
    const pIdClean = patientId.toLowerCase().replace(/^(usr_patient_|pt_)/, '').trim();
    return this.getLabOrders().filter((o) => {
      const oPid = (o.patientId || '').toLowerCase().replace(/^(usr_patient_|pt_)/, '').trim();
      const oName = (o.patientName || '').toLowerCase().trim();
      return oPid === pIdClean || (oName && pIdClean.length > 2 && oName.includes(pIdClean));
    });
  }

  // AI Audit Logs (Starts completely empty [])
  getAILogs(): AILog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_LOGS);
    return raw ? JSON.parse(raw) : [];
  }

  saveAILog(log: AILog): void {
    const logs = this.getAILogs();
    logs.unshift(log); // Prepend latest log
    // Keep last 100 AI interaction logs
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEYS.AI_LOGS, JSON.stringify(logs));
  }

  // Gemini Chatbot Multi-Turn History
  getChatHistory(userId: string): import('../types').ChatMessage[] {
    const key = `pulsecare_chat_history_${userId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  saveChatHistory(userId: string, messages: import('../types').ChatMessage[]): void {
    const key = `pulsecare_chat_history_${userId}`;
    localStorage.setItem(key, JSON.stringify(messages));
  }

  clearChatHistory(userId: string): void {
    const key = `pulsecare_chat_history_${userId}`;
    localStorage.removeItem(key);
  }

  // Forgot Password System
  createPasswordResetToken(email: string): string | null {
    const user = this.findUserByEmail(email);
    if (!user) return null;

    const token = 'RESET-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins expiry
    const resets = this.getPasswordResets();
    resets[token] = { email, expiresAt };
    localStorage.setItem(STORAGE_KEYS.PASSWORD_RESETS, JSON.stringify(resets));
    return token;
  }

  private getPasswordResets(): Record<string, { email: string; expiresAt: number }> {
    const raw = localStorage.getItem(STORAGE_KEYS.PASSWORD_RESETS);
    return raw ? JSON.parse(raw) : {};
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const resets = this.getPasswordResets();
    const record = resets[token];
    if (!record || record.expiresAt < Date.now()) {
      return false;
    }

    const user = this.findUserByEmail(record.email);
    if (!user) return false;

    user.passwordHash = await hashPassword(newPassword);
    this.saveUser(user);

    // Delete used token
    delete resets[token];
    localStorage.setItem(STORAGE_KEYS.PASSWORD_RESETS, JSON.stringify(resets));
    return true;
  }
}

export const storage = new StorageManager();
