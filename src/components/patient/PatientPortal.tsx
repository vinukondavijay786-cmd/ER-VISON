import React, { useState, useEffect } from 'react';
import { User, Appointment, DoctorClinicalNote, LabOrder, PrescriptionItem } from '../../types';
import { storage } from '../../services/storage';
import { aiService, SymptomCheckResult, HealthSummaryResult, MedicationExplanationResult } from '../../services/aiService';
import {
  Activity,
  Calendar,
  Clock,
  FileText,
  Pill,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  PlusCircle,
  HelpCircle,
  X,
  Stethoscope,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Heart,
  Droplets,
  Phone,
  User as UserIcon,
  Info,
  Zap,
  Thermometer,
  TrendingUp,
  Sun,
  Moon,
  RotateCcw,
} from 'lucide-react';

interface PatientPortalProps {
  user: User;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'symptom_checker' | 'appointments' | 'records' | 'prescriptions'>('overview');

  // Appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorsList, setDoctorsList] = useState<User[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // Reschedule state
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('02:00 PM');

  // Clinical Records & Labs & Notes
  const [clinicalNotes, setClinicalNotes] = useState<DoctorClinicalNote[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // AI Symptom Checker
  const [symptomInput, setSymptomInput] = useState('');
  const [durationInput, setDurationInput] = useState('1-2 days');
  const [symptomResult, setSymptomResult] = useState<SymptomCheckResult | null>(null);
  const [isCheckingSymptoms, setIsCheckingSymptoms] = useState(false);

  // AI Plain-English Health Summary
  const [healthSummary, setHealthSummary] = useState<HealthSummaryResult | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // AI Medication Explainer Modal
  const [selectedMedication, setSelectedMedication] = useState<PrescriptionItem | null>(null);
  const [medExplanation, setMedExplanation] = useState<MedicationExplanationResult | null>(null);
  const [isLoadingMedExplanation, setIsLoadingMedExplanation] = useState(false);

  // Add Home Medication / Vitamin State
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFrequency, setNewMedFrequency] = useState('Once daily in the morning');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [copiedTriageReport, setCopiedTriageReport] = useState(false);

  // 1-Click Quick Vitals Log State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [logBP, setLogBP] = useState('120/80');
  const [logHeartRate, setLogHeartRate] = useState(72);
  const [logBloodSugar, setLogBloodSugar] = useState(96);
  const [logTemp, setLogTemp] = useState(98.6);
  const [vitalsHistory, setVitalsHistory] = useState<
    Array<{
      date: string;
      bp: string;
      hr: number;
      sugar: number;
      temp: number;
      status: string;
    }>
  >(() => {
    try {
      const raw = localStorage.getItem(`ervision_vitals_${user.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Patient Profile
  const [patientProfile, setPatientProfile] = useState<User>(user);

  const loadData = () => {
    // Doctors
    const allUsers = storage.getUsers();
    const doctors = allUsers.filter((u) => u.role === 'doctor');
    setDoctorsList(doctors);

    // Appointments for this patient
    const allAppointments = storage.getAppointments();
    const userAppointments = allAppointments.filter(
      (a) => a.patientId === user.id || a.patientEmail.toLowerCase() === user.email.toLowerCase()
    );
    setAppointments(userAppointments);

    // Helper to get pure root medication name (e.g., amoxicillin, lisinopril, ibuprofen)
    const getRootMedName = (med: string): string => {
      return (
        med
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/\b\d+(\.\d+)?(\/\d+)?\s*(mg|mcg|ml|g|%)\b/gi, '')
          .replace(/[^a-z0-9]/g, ' ')
          .trim()
          .split(/\s+/)[0] || med.toLowerCase().trim()
      );
    };

    // 1. Clinical encounter records - strictly ONE record per medical consultation/condition
    const allNotes = storage.getClinicalNotes();
    const cleanUserId = user.id.toLowerCase().replace(/^(usr_patient_|pt_)/, '');
    const cleanUserName = user.name.toLowerCase().trim();

    const rawUserNotes = allNotes.filter((n) => {
      if (n.doctorId === 'self_tracked' || n.doctorName === 'Self-Reported / Patient Chart') return false;
      const nPid = (n.patientId || '').toLowerCase().replace(/^(usr_patient_|pt_)/, '');
      const nPname = (n.patientName || '').toLowerCase().trim();
      return nPid === cleanUserId || nPname === cleanUserName || (cleanUserName.length > 2 && nPname.includes(cleanUserName));
    });

    const uniqueUserNotes: DoctorClinicalNote[] = [];
    const seenDiagnosisRoots = new Set<string>();

    // Sort latest signed notes first
    const sortedUserNotes = [...rawUserNotes].sort(
      (a, b) =>
        new Date(b.signedAt || b.createdAt).getTime() - new Date(a.signedAt || a.createdAt).getTime()
    );

    sortedUserNotes.forEach((n) => {
      // Extract root condition words from assessment or subjective
      const conditionRoot = (n.assessment || n.subjective || 'consultation')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 2)
        .join('_') || 'encounter';

      if (!seenDiagnosisRoots.has(conditionRoot)) {
        seenDiagnosisRoots.add(conditionRoot);
        uniqueUserNotes.push(n);
      }
    });
    setClinicalNotes(uniqueUserNotes);

    // 2. Diagnostic Lab & Imaging Reports - strictly ONE entry per diagnostic test
    const allLabs = storage.getLabOrders();
    const rawUserLabs = allLabs.filter((l) => {
      const lPid = (l.patientId || '').toLowerCase().replace(/^(usr_patient_|pt_)/, '');
      const lPname = (l.patientName || '').toLowerCase().trim();
      return lPid === cleanUserId || lPname === cleanUserName || (cleanUserName.length > 2 && lPname.includes(cleanUserName));
    });

    const uniqueUserLabs: LabOrder[] = [];
    const seenTestRoots = new Set<string>();

    // Prefer completed resulted labs first, then most recent order
    const sortedUserLabs = [...rawUserLabs].sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;
      return new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime();
    });

    sortedUserLabs.forEach((l) => {
      const testRoot = l.testName
        .toLowerCase()
        .replace(/stat|\&|12-lead|high-sensitivity|hs-ctni|troponin/gi, 'troponin')
        .replace(/[^a-z0-9]/g, '')
        .trim();

      if (!seenTestRoots.has(testRoot)) {
        seenTestRoots.add(testRoot);
        uniqueUserLabs.push(l);
      }
    });
    setLabOrders(uniqueUserLabs);

    // 3. Active Prescriptions - strictly ONE entry per distinct active medication
    const activePrescriptions: PrescriptionItem[] = [];
    const seenMedRoots = new Set<string>();

    // Pull from all patient records (including self-added medications)
    const allPatientNotes = allNotes.filter((n) => {
      const nPid = (n.patientId || '').toLowerCase().replace(/^(usr_patient_|pt_)/, '');
      const nPname = (n.patientName || '').toLowerCase().trim();
      return nPid === cleanUserId || nPname === cleanUserName || (cleanUserName.length > 2 && nPname.includes(cleanUserName));
    });

    const sortedAllNotes = [...allPatientNotes].sort(
      (a, b) =>
        new Date(b.signedAt || b.createdAt).getTime() - new Date(a.signedAt || a.createdAt).getTime()
    );

    sortedAllNotes.forEach((n) => {
      if (n.prescriptions && Array.isArray(n.prescriptions)) {
        n.prescriptions.forEach((p) => {
          const rootKey = getRootMedName(p.medication || '');
          if (rootKey && !seenMedRoots.has(rootKey)) {
            seenMedRoots.add(rootKey);
            activePrescriptions.push(p);
          } else if (rootKey && seenMedRoots.has(rootKey)) {
            // Consolidate adherence logs into the existing single card
            const existing = activePrescriptions.find(
              (ep) => getRootMedName(ep.medication) === rootKey
            );
            if (existing && p.adherenceLogs && p.adherenceLogs.length > 0) {
              const existingLogs = existing.adherenceLogs ? [...existing.adherenceLogs] : [];
              p.adherenceLogs.forEach((l) => {
                if (
                  !existingLogs.some(
                    (el) => el.date === l.date && (el.slotIndex ?? 0) === (l.slotIndex ?? 0)
                  )
                ) {
                  existingLogs.push(l);
                }
              });
              existing.adherenceLogs = existingLogs;
            }
          }
        });
      }
    });
    setPrescriptions(activePrescriptions);

    // Update user profile from storage
    const updatedUser = storage.findUserById(user.id);
    if (updatedUser) setPatientProfile(updatedUser);
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  // Book Appointment
  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) return;

    let doctorName = 'Hospital Specialist';
    let specialty = 'General Outpatient';

    if (selectedDoctorId) {
      const doc = doctorsList.find((d) => d.id === selectedDoctorId);
      if (doc) {
        doctorName = doc.name;
        specialty = doc.specialty || 'General Medicine';
      }
    }

    const newAppointment: Appointment = {
      id: 'apt_' + Math.random().toString(36).substring(2, 9),
      patientId: user.id,
      patientName: user.name,
      patientEmail: user.email,
      doctorId: selectedDoctorId || 'doc_general',
      doctorName,
      specialty,
      dateTime: `${bookingDate} at ${bookingTime}`,
      reason: bookingReason || 'General medical examination',
      notes: bookingNotes,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    storage.saveAppointment(newAppointment);
    setShowBookingModal(false);
    setBookingReason('');
    setBookingNotes('');
    loadData();
  };

  // Cancel Appointment
  const handleCancelAppointment = (id: string) => {
    const apt = appointments.find((a) => a.id === id);
    if (apt) {
      apt.status = 'cancelled';
      storage.saveAppointment(apt);
      loadData();
    }
  };

  // Reschedule Appointment
  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppointmentId || !rescheduleDate) return;

    const apt = appointments.find((a) => a.id === rescheduleAppointmentId);
    if (apt) {
      apt.dateTime = `${rescheduleDate} at ${rescheduleTime}`;
      apt.status = 'rescheduled';
      storage.saveAppointment(apt);
      setRescheduleAppointmentId(null);
      loadData();
    }
  };

  // Run AI Symptom Checker
  const handleCheckSymptoms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomInput.trim()) return;

    setIsCheckingSymptoms(true);
    setSymptomResult(null);

    const result = await aiService.checkSymptoms({
      symptoms: symptomInput.trim(),
      age: patientProfile.dob || 'Adult',
      gender: 'Patient',
      duration: durationInput,
      chronicConditions: patientProfile.allergies?.join(', '),
      userId: user.id,
    });

    setSymptomResult(result);
    setIsCheckingSymptoms(false);
  };

  // Generate AI Plain-English Health Summary
  const handleGenerateHealthSummary = async () => {
    setIsGeneratingSummary(true);
    const summary = await aiService.generateHealthSummary({
      notes: clinicalNotes,
      labOrders,
      prescriptions,
      patientName: user.name,
      userId: user.id,
    });
    setHealthSummary(summary);
    setIsGeneratingSummary(false);
  };

  // Explain Medication
  const handleExplainMedication = async (med: PrescriptionItem) => {
    setSelectedMedication(med);
    setIsLoadingMedExplanation(true);
    const explanation = await aiService.explainMedication({
      medicationName: med.medication,
      dosage: med.dosage,
    });
    setMedExplanation(explanation);
    setIsLoadingMedExplanation(false);
  };

  // Helper: Break down medication frequency into distinct clinical dose slots
  const parseFrequencyToSlots = (frequency: string) => {
    const f = (frequency || '').toLowerCase();
    if (f.includes('twice') || f.includes('2x') || f.includes('bid') || f.includes('every 12') || f.includes('2 times')) {
      return [
        { index: 0, name: 'Morning Dose', tabletLabel: 'Tablet 1 of 2', time: '08:00 AM', timingHint: 'With breakfast', period: 'morning' as const },
        { index: 1, name: 'Evening Dose', tabletLabel: 'Tablet 2 of 2', time: '08:00 PM', timingHint: 'With dinner', period: 'evening' as const },
      ];
    }
    if (f.includes('three') || f.includes('3x') || f.includes('tid') || f.includes('every 8') || f.includes('3 times')) {
      return [
        { index: 0, name: 'Morning Dose', tabletLabel: 'Tablet 1 of 3', time: '08:00 AM', timingHint: 'With breakfast', period: 'morning' as const },
        { index: 1, name: 'Afternoon Dose', tabletLabel: 'Tablet 2 of 3', time: '02:00 PM', timingHint: 'With lunch', period: 'afternoon' as const },
        { index: 2, name: 'Evening Dose', tabletLabel: 'Tablet 3 of 3', time: '08:00 PM', timingHint: 'With dinner', period: 'evening' as const },
      ];
    }
    if (f.includes('four') || f.includes('4x') || f.includes('qid') || f.includes('every 6') || f.includes('4 times')) {
      return [
        { index: 0, name: 'Morning Dose', tabletLabel: 'Tablet 1 of 4', time: '08:00 AM', timingHint: 'With breakfast', period: 'morning' as const },
        { index: 1, name: 'Midday Dose', tabletLabel: 'Tablet 2 of 4', time: '12:00 PM', timingHint: 'With lunch', period: 'afternoon' as const },
        { index: 2, name: 'Evening Dose', tabletLabel: 'Tablet 3 of 4', time: '06:00 PM', timingHint: 'With dinner', period: 'evening' as const },
        { index: 3, name: 'Bedtime Dose', tabletLabel: 'Tablet 4 of 4', time: '10:00 PM', timingHint: 'Before sleep', period: 'bedtime' as const },
      ];
    }
    if (f.includes('bedtime') || f.includes('night') || f.includes('evening') || f.includes('pm')) {
      return [
        { index: 0, name: 'Night / Bedtime Dose', tabletLabel: 'Tablet 1 of 1', time: '09:00 PM', timingHint: 'Before sleep', period: 'bedtime' as const },
      ];
    }
    return [
      { index: 0, name: 'Morning Dose', tabletLabel: 'Tablet 1 of 1', time: '08:00 AM', timingHint: 'Once daily with water', period: 'morning' as const },
    ];
  };

  // Toggle specific Tablet Slot adherence (Clinical-grade isolation)
  const handleToggleSlot = (medId: string, slotIndex: number, slotName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let newTaken = true;
    const targetMed = prescriptions.find((p) => p.id === medId);
    if (targetMed && targetMed.adherenceLogs) {
      const existing = targetMed.adherenceLogs.find(
        (l) => l.date === today && (l.slotIndex ?? 0) === slotIndex
      );
      if (existing && existing.taken) {
        newTaken = false;
      }
    }

    // 1. Update React state for THIS specific tablet slot only
    const updated = prescriptions.map((p) => {
      if (p.id === medId) {
        const logs = [...(p.adherenceLogs || [])];
        const existingIdx = logs.findIndex(
          (l) => l.date === today && (l.slotIndex ?? 0) === slotIndex
        );
        if (existingIdx >= 0) {
          logs[existingIdx] = {
            ...logs[existingIdx],
            taken: newTaken,
            slotIndex,
            slotName,
            takenAt: newTaken ? nowTime : undefined,
          };
        } else {
          logs.push({
            date: today,
            slotIndex,
            slotName,
            taken: newTaken,
            takenAt: newTaken ? nowTime : undefined,
          });
        }
        return { ...p, adherenceLogs: logs };
      }
      return p;
    });
    setPrescriptions(updated);

    // 2. Persist to storage across all clinical notes
    storage.updatePrescriptionSlotAdherence(
      user.id,
      medId,
      today,
      slotIndex,
      slotName,
      newTaken,
      newTaken ? nowTime : undefined
    );
  };

  // Backward compatibility alias for single-med toggle (toggles first slot)
  const handleToggleAdherence = (medId: string) => {
    const targetMed = prescriptions.find((p) => p.id === medId);
    const slots = targetMed ? parseFrequencyToSlots(targetMed.frequency) : [{ index: 0, name: 'Daily Dose' }];
    handleToggleSlot(medId, slots[0].index, slots[0].name);
  };

  // 1-Click Save Vitals
  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = logBP.split('/');
    const sys = parseInt(parts[0] || '120', 10);
    const dia = parseInt(parts[1] || '80', 10);

    let status = 'Optimal / Normal';
    if (sys >= 140 || dia >= 90) status = 'Stage 2 Hypertension';
    else if (sys >= 130 || dia >= 80) status = 'Stage 1 Hypertension';
    else if (sys >= 120 && dia < 80) status = 'Elevated Blood Pressure';

    const entry = {
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      bp: logBP,
      hr: Number(logHeartRate),
      sugar: Number(logBloodSugar),
      temp: Number(logTemp),
      status,
    };
    const updated = [entry, ...vitalsHistory].slice(0, 10);
    setVitalsHistory(updated);
    try {
      localStorage.setItem(`ervision_vitals_${user.id}`, JSON.stringify(updated));
    } catch {
      // storage quota or disabled
    }
    setShowVitalsModal(false);
  };

  // 1-Click Quick Symptom Checker Trigger
  const handleQuickSymptomCheck = async (symptomText: string) => {
    setSymptomInput(symptomText);
    setActiveTab('symptom_checker');
    setIsCheckingSymptoms(true);
    setSymptomResult(null);

    const result = await aiService.checkSymptoms({
      symptoms: symptomText,
      age: patientProfile.dob || 'Adult',
      gender: 'Patient',
      duration: '1-2 days',
      chronicConditions: patientProfile.allergies?.join(', '),
      userId: user.id,
    });

    setSymptomResult(result);
    setIsCheckingSymptoms(false);
  };

  // Add Home Medication / Vitamin
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    const newMed: PrescriptionItem = {
      id: 'rx_home_' + Math.random().toString(36).substring(2, 9),
      medication: newMedName.trim(),
      dosage: newMedDosage.trim() || 'Daily dose',
      frequency: newMedFrequency,
      route: 'Oral',
      duration: 'Ongoing / Chronic',
      instructions: newMedInstructions.trim() || 'Take with water as directed.',
      precautions: 'Consult physician if unusual symptoms or side effects develop.',
      adherenceLogs: [],
    };

    let userNotes = storage.getClinicalNotesByPatient(user.id);
    let noteToUpdate = userNotes[0];
    if (!noteToUpdate) {
      noteToUpdate = {
        id: 'note_patient_meds_' + user.id,
        patientId: user.id,
        patientMrn: 'PC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000),
        patientName: user.name,
        doctorId: 'self_tracked',
        doctorName: 'Self-Reported / Patient Chart',
        specialty: 'Patient Self-Care & Medications',
        subjective: 'Patient-recorded daily medications and vitamins.',
        objective: 'Self-reported medication intake profile.',
        assessment: 'Active medication tracking',
        plan: 'Adhere to recommended daily dosing schedule.',
        differentialDiagnoses: ['Patient Self-Management'],
        dischargeInstructions: 'Maintain regular compliance.',
        prescriptions: [newMed],
        status: 'signed',
        signedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } else {
      if (!noteToUpdate.prescriptions) noteToUpdate.prescriptions = [];
      const getRoot = (m: string) =>
        m
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/\b\d+(\.\d+)?(\/\d+)?\s*(mg|mcg|ml|g|%)\b/gi, '')
          .replace(/[^a-z0-9]/g, ' ')
          .trim()
          .split(/\s+/)[0] || m.toLowerCase().trim();

      const existingIdx = noteToUpdate.prescriptions.findIndex(
        (p) => getRoot(p.medication) === getRoot(newMed.medication)
      );
      if (existingIdx >= 0) {
        noteToUpdate.prescriptions[existingIdx] = {
          ...noteToUpdate.prescriptions[existingIdx],
          ...newMed,
          id: noteToUpdate.prescriptions[existingIdx].id,
          adherenceLogs: noteToUpdate.prescriptions[existingIdx].adherenceLogs || [],
        };
      } else {
        noteToUpdate.prescriptions.push(newMed);
      }
    }
    storage.saveClinicalNote(noteToUpdate);
    loadData();

    setShowAddMedModal(false);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedInstructions('');
  };

  const handleAddMedPreset = (name: string, dose: string, freq: string, instr: string) => {
    setNewMedName(name);
    setNewMedDosage(dose);
    setNewMedFrequency(freq);
    setNewMedInstructions(instr);
    setShowAddMedModal(true);
  };

  const handleCopyTriage = () => {
    if (!symptomResult) return;
    const reportText = `[ER Vision AI Symptom Triage Report]\nSymptoms: ${symptomInput}\nTriage Level: ${symptomResult.triageLevel}\nAssessment: ${symptomResult.analysis}\nRecommended Action: ${symptomResult.recommendedAction}\nSelf-Care Tips:\n${symptomResult.selfCareTips.map((t) => `- ${t}`).join('\n')}\nQuestions for Doctor:\n${symptomResult.questionsToAskDoctor.map((q) => `- ${q}`).join('\n')}`;
    navigator.clipboard.writeText(reportText);
    setCopiedTriageReport(true);
    setTimeout(() => setCopiedTriageReport(false), 3000);
  };

  const handlePrintRecords = () => {
    window.print();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 pb-16">
      {/* Top Banner Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-3 overflow-x-auto py-2.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                activeTab === 'overview'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Heart className="h-4 w-4 text-emerald-600" />
              <span>Dashboard & Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('symptom_checker')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                activeTab === 'symptom_checker'
                  ? 'bg-sky-50 text-sky-800 border border-sky-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="h-4 w-4 text-sky-600" />
              <span>AI Symptom Checker</span>
            </button>

            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                activeTab === 'appointments'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Appointments ({appointments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                activeTab === 'records'
                  ? 'bg-purple-50 text-purple-800 border border-purple-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="h-4 w-4 text-purple-600" />
              <span>Health Records & Labs</span>
            </button>

            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                activeTab === 'prescriptions'
                  ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Pill className="h-4 w-4 text-teal-600" />
              <span>Prescriptions ({prescriptions.length})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ===================== TAB 1: OVERVIEW & AI SUMMARY ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Patient Welcome Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    <UserIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Verified Patient Account</span>
                    <span>· MRN: PC-{user.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Welcome back, {user.name}
                  </h2>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Check your symptoms with Gemini AI, book hospital specialist visits, and review clear plain-English health summaries.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setActiveTab('symptom_checker')}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white text-xs font-bold flex items-center space-x-2 shadow-xs transition-all"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Check Symptoms with AI</span>
                  </button>

                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center space-x-2 transition-colors"
                  >
                    <Calendar className="h-4 w-4 text-sky-600" />
                    <span>Book Specialist</span>
                  </button>
                </div>
              </div>

              {/* Patient Key Profile Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
                    <Droplets className="h-3.5 w-3.5 text-rose-500" />
                    <span>Blood Group</span>
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {patientProfile.bloodGroup || 'O+'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span>Date of Birth</span>
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {patientProfile.dob || 'Not set'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span>Documented Allergies</span>
                  </span>
                  <p className="text-base font-bold text-amber-700 mt-1">
                    {patientProfile.allergies && patientProfile.allergies.length > 0
                      ? patientProfile.allergies.join(', ')
                      : 'None reported'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Emergency Contact</span>
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {patientProfile.emergencyContact || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* ================= CLICK & DO MY WORK: FAST PATIENT DASHBOARD ACTIONS ================= */}
            <div className="bg-gradient-to-r from-sky-50 via-white to-emerald-50/50 border border-sky-200/80 rounded-3xl p-6 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sky-100 gap-3 mb-5">
                <div>
                  <div className="inline-flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-sky-800 bg-sky-100/90 px-3 py-1 rounded-full border border-sky-200 mb-1">
                    <Zap className="h-3.5 w-3.5 text-sky-600" />
                    <span>Click & Do Your Work Easily</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    Fast Patient Health Command Bar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any action below to immediately log vitals, run 1-click symptom checks, or book appointments.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVitalsModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs transition-all flex items-center space-x-2 shadow-xs shrink-0 cursor-pointer"
                >
                  <Thermometer className="h-4 w-4" />
                  <span>Log Today's Vitals (1-Click)</span>
                </button>
              </div>

              {/* Vitals Summary Strip */}
              {vitalsHistory.length > 0 ? (
                <div className="mb-5 bg-white p-4 rounded-2xl border border-sky-100 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span>Latest Recorded Vitals · {vitalsHistory[0].date}</span>
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {vitalsHistory[0].status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Blood Pressure</span>
                      <strong className="text-sm font-black text-slate-900">{vitalsHistory[0].bp} mmHg</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Heart Rate</span>
                      <strong className="text-sm font-black text-slate-900">{vitalsHistory[0].hr} bpm</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Blood Glucose</span>
                      <strong className="text-sm font-black text-slate-900">{vitalsHistory[0].sugar} mg/dL</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Body Temp</span>
                      <strong className="text-sm font-black text-slate-900">{vitalsHistory[0].temp} °F</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-5 bg-white/80 p-3.5 rounded-2xl border border-dashed border-sky-200 text-xs text-slate-600 flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Thermometer className="h-4 w-4 text-sky-600" />
                    <span>No vitals recorded today. Click &quot;Log Today's Vitals&quot; to track your BP & pulse.</span>
                  </span>
                  <button
                    onClick={() => setShowVitalsModal(true)}
                    className="text-sky-600 hover:text-sky-700 font-bold underline ml-2"
                  >
                    Log now →
                  </button>
                </div>
              )}

              {/* 1-Click Fast Symptom Starters */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  1-Click AI Symptom Starters (Instant Analysis):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleQuickSymptomCheck('Sudden sharp chest pressure with shortness of breath and cold sweats')}
                    className="p-3 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-left transition-all shadow-xs cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700 flex items-center justify-between">
                      <span>🫀 Chest Tightness</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-rose-600 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Pressure & breathing difficulty</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSymptomCheck('Severe throbbing migraine with aura and light sensitivity')}
                    className="p-3 rounded-2xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-left transition-all shadow-xs cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 flex items-center justify-between">
                      <span>🧠 Severe Migraine</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-purple-600 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Throbbing headache & light sensitivity</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSymptomCheck('High fever 102.5 F with persistent dry cough and body aches')}
                    className="p-3 rounded-2xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-left transition-all shadow-xs cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 flex items-center justify-between">
                      <span>🌡️ High Fever & Cough</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-amber-600 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">102.5°F fever & body aches</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSymptomCheck('Sharp right lower quadrant abdominal pain with nausea and chills')}
                    className="p-3 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left transition-all shadow-xs cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700 flex items-center justify-between">
                      <span>🩺 Acute Abdominal Pain</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Sharp RLQ pain & nausea</p>
                  </button>
                </div>
              </div>

              {/* Today's Tablet Dosing & Adherence Tracker (Clinical MAR) */}
              {prescriptions.length > 0 && (() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const allSlots = prescriptions.flatMap((med) => {
                  const slots = parseFrequencyToSlots(med.frequency);
                  return slots.map((slot) => {
                    const isTaken = !!med.adherenceLogs?.some(
                      (l) => l.date === todayStr && (l.slotIndex ?? 0) === slot.index && l.taken
                    );
                    const log = med.adherenceLogs?.find(
                      (l) => l.date === todayStr && (l.slotIndex ?? 0) === slot.index && l.taken
                    );
                    return {
                      med,
                      slot,
                      isTaken,
                      takenAt: log?.takenAt,
                    };
                  });
                });

                const totalTablets = allSlots.length;
                const takenTablets = allSlots.filter((s) => s.isTaken).length;
                const adherencePct = totalTablets > 0 ? Math.round((takenTablets / totalTablets) * 100) : 100;

                return (
                  <div className="mt-5 pt-4 border-t border-sky-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2 text-xs">
                          <Pill className="h-4 w-4 text-teal-600" />
                          <span className="font-bold text-slate-900">Today's Medication Dosing Schedule:</span>
                          <span className="text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 text-[11px]">
                            {takenTablets} of {totalTablets} Tablets Taken ({adherencePct}%)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Each tablet dose is tracked independently. Click any tablet when taken to log compliance.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('prescriptions')}
                        className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center space-x-1 shrink-0"
                      >
                        <span>Open Full Tracker</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Adherence Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          adherencePct === 100 ? 'bg-emerald-500' : adherencePct > 0 ? 'bg-teal-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${adherencePct}%` }}
                      />
                    </div>

                    {/* Today's Scheduled Tablets List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {allSlots.map((item, idx) => (
                        <div
                          key={`${item.med.id}_slot_${item.slot.index}_${idx}`}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between text-xs ${
                            item.isTaken
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-teal-300'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-slate-900 truncate flex items-center space-x-1.5">
                              <span className="truncate">{item.med.medication}</span>
                              <span className="text-[10px] text-teal-700 font-normal shrink-0">({item.med.dosage})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              {item.slot.period === 'morning' ? (
                                <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                              ) : (
                                <Moon className="h-3 w-3 text-indigo-500 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-700">{item.slot.tabletLabel}</span>
                              <span>· {item.slot.time}</span>
                            </div>
                            {item.isTaken && item.takenAt && (
                              <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                Logged at {item.takenAt}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center space-x-1">
                            {item.isTaken ? (
                              <div className="flex items-center space-x-1">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Taken</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSlot(item.med.id, item.slot.index, item.slot.name)}
                                  title="Undo dose if logged by mistake"
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleSlot(item.med.id, item.slot.index, item.slot.name)}
                                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center space-x-1 transition-all shadow-xs cursor-pointer"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Take</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* AI Plain-English Health Summary Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      AI Plain-English Health Summary
                    </h3>
                    <p className="text-xs text-slate-500">
                      Synthesizes physician SOAP notes, lab results, and active medications into clear, reassuring everyday words.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleGenerateHealthSummary}
                  disabled={isGeneratingSummary}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold text-white text-xs transition-colors flex items-center justify-center space-x-2 shrink-0 shadow-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingSummary ? 'Synthesizing...' : 'Generate AI Summary'}</span>
                </button>
              </div>

              {healthSummary ? (
                <div className="mt-5 space-y-4">
                  <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {healthSummary.plainEnglishSummary}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Recommended Next Actions</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {healthSummary.keyActionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
                      <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                        <span>When to Call Doctor / ER</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {healthSummary.warningSigns.map((item, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-rose-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">
                  Click &quot;Generate AI Summary&quot; to transform your clinical records and active medications into clear, easy-to-understand explanations.
                </div>
              )}
            </div>

            {/* Quick Two-Column View: Upcoming Visits & Active Medications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Appointments */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-sky-600" />
                    <span>Upcoming Appointments</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('appointments')}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1"
                  >
                    <span>View All</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {appointments.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No scheduled appointments yet.</p>
                    <button
                      onClick={() => setShowBookingModal(true)}
                      className="mt-3 text-xs text-sky-600 hover:underline font-bold"
                    >
                      Book your first consultation →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {appointments.slice(0, 3).map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{apt.doctorName}</div>
                          <div className="text-[11px] text-sky-700 font-semibold">{apt.specialty}</div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{apt.dateTime}</span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            apt.status === 'scheduled'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : apt.status === 'rescheduled'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {apt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Prescriptions Quick View */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Pill className="h-4 w-4 text-teal-600" />
                    <span>Active Prescriptions</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('prescriptions')}
                    className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center space-x-1"
                  >
                    <span>View Tracker</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Pill className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No active prescriptions currently on record.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {prescriptions.slice(0, 3).map((med, idx) => (
                      <div
                        key={`${med.id || 'rx'}_${idx}`}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{med.medication}</div>
                          <div className="text-[11px] text-teal-700 font-semibold">
                            {med.dosage} · {med.frequency}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{med.instructions}</div>
                        </div>
                        <button
                          onClick={() => handleExplainMedication(med)}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-bold hover:bg-teal-100"
                        >
                          Ask AI
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: AI SYMPTOM CHECKER ===================== */}
        {activeTab === 'symptom_checker' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">AI Symptom Checker & Triage Assistant</h2>
                  <p className="text-xs text-slate-500">
                    Describe your symptoms in natural language. The clinical AI evaluates complaints, highlights red flags, and suggests appropriate care levels.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCheckSymptoms} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Describe what you are feeling in your own words
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    placeholder="e.g. Throbbing pain behind my right eye for 12 hours, sensitive to bright light, slight nausea, temperature feels normal..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duration of Symptoms
                    </label>
                    <select
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                    >
                      <option value="Less than 6 hours">Less than 6 hours (Sudden onset)</option>
                      <option value="6 to 24 hours">6 to 24 hours</option>
                      <option value="1 to 2 days">1 to 2 days</option>
                      <option value="3 to 7 days">3 to 7 days</option>
                      <option value="Over a week">Over a week (Persistent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quick Clinical Samples (Click to test)
                    </label>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSymptomInput('Sharp pain in lower right abdomen for 8 hours with mild fever, vomiting, and loss of appetite.');
                          setDurationInput('6 to 24 hours');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold border border-slate-200"
                      >
                        Abdominal Pain
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSymptomInput('Sudden crushing chest tightness radiating down left arm with shortness of breath and cold sweat.');
                          setDurationInput('Less than 6 hours');
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200"
                      >
                        Chest Pressure (Emergency)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSymptomInput('Sore throat, runny nose, sneezing, mild dry cough for 3 days, no fever.');
                          setDurationInput('3 to 7 days');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold border border-slate-200"
                      >
                        Mild Cold
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCheckingSymptoms}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shadow-xs"
                >
                  {isCheckingSymptoms ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Analyzing Clinical Complaints...</span>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Analyze Symptoms with AI Assistant</span>
                    </>
                  )}
                </button>
              </form>

              {/* Triage Results Display */}
              {symptomResult && (
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-5">
                  {/* Triage Level Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      symptomResult.triageLevel === 'Emergency'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : symptomResult.triageLevel === 'Urgent Care'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-white shadow-xs">
                        {symptomResult.triageLevel === 'Emergency' ? (
                          <AlertTriangle className="h-6 w-6 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                          Recommended Care Setting
                        </span>
                        <h3 className="text-lg font-bold">
                          {symptomResult.triageLevel} Assessment
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyTriage}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        title="Copy full triage findings to clipboard"
                      >
                        <CheckCircle2 className={`h-4 w-4 ${copiedTriageReport ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{copiedTriageReport ? 'Report Copied!' : 'Copy Summary'}</span>
                      </button>

                      {symptomResult.triageLevel === 'Emergency' ? (
                        <a
                          href="tel:911"
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5"
                        >
                          <Phone className="h-4 w-4" />
                          <span>Call 911 / ER</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            setBookingReason(symptomInput);
                            setBookingNotes(`AI Triage: ${symptomResult.triageLevel} - ${symptomResult.recommendedAction}`);
                            setShowBookingModal(true);
                          }}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Calendar className="h-4 w-4" />
                          <span>Schedule Clinic Visit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Red Flags Banner if any */}
                  {symptomResult.emergencyFlags && symptomResult.emergencyFlags.length > 0 && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 mb-1.5 text-rose-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Clinical Red-Flag Indicators Detected</span>
                      </h4>
                      <ul className="list-disc list-inside text-xs space-y-1 text-rose-700 font-medium">
                        {symptomResult.emergencyFlags.map((flag, i) => (
                          <li key={i}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Clinical Analysis Explanation */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Clinical Health Guidance
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {symptomResult.analysis}
                    </p>
                    <p className="text-xs text-sky-700 font-bold mt-3">
                      Action Recommendation: {symptomResult.recommendedAction}
                    </p>
                  </div>

                  {/* Self-Care & Doctor Questions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200">
                      <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                        <span>Self-Care & Comfort Measures</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {symptomResult.selfCareTips.map((tip, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-teal-600 font-bold">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
                      <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <HelpCircle className="h-4 w-4 text-purple-600" />
                        <span>Questions to Ask Your Doctor</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {symptomResult.questionsToAskDoctor.map((q, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-purple-600 font-bold">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: APPOINTMENTS ===================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Appointments</h2>
                <p className="text-xs text-slate-500">
                  Schedule, reschedule, or cancel consultations with hospital physicians and specialists.
                </p>
              </div>
              <button
                onClick={() => setShowBookingModal(true)}
                className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors flex items-center space-x-2 shadow-xs shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Book New Appointment</span>
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">No Consultations Scheduled</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                  Your appointment schedule is currently empty. Book a consultation with a cardiologist, general physician, or specialist.
                </p>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="py-2.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Schedule Appointment
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                          {apt.specialty}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                            apt.status === 'scheduled'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : apt.status === 'rescheduled'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {apt.status}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900">{apt.doctorName}</h4>

                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{apt.dateTime}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-3 text-xs text-slate-700">
                        <span className="text-slate-500 font-semibold">Reason for Visit:</span>{' '}
                        {apt.reason}
                        {apt.notes && (
                          <div className="text-slate-500 mt-1 italic">&ldquo;{apt.notes}&rdquo;</div>
                        )}
                      </div>
                    </div>

                    {apt.status !== 'cancelled' && (
                      <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setRescheduleAppointmentId(apt.id);
                            setRescheduleDate(new Date().toISOString().split('T')[0]);
                          }}
                          className="w-1/2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="w-1/2 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                        >
                          Cancel Visit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: HEALTH RECORDS & LABS ===================== */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Personal Health Records (PHR)</h2>
                <p className="text-xs text-slate-500">
                  Official clinical encounter summaries, doctor SOAP assessments, and diagnostic lab reports.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintRecords}
                className="py-2 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              >
                <FileText className="h-4 w-4 text-purple-600" />
                <span>Print / Save PHR Summary</span>
              </button>
            </div>

            {/* Clinical Encounter Notes */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span>Physician Encounter Records & SOAP Notes</span>
              </h3>

              {clinicalNotes.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">
                    No clinical documentation records on file yet. Once a physician completes an encounter in the Doctor Portal, the note and diagnosis will display here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{note.doctorName}</div>
                          <div className="text-xs text-purple-700 font-semibold">{note.specialty}</div>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-2">
                          <span>Signed: {new Date(note.signedAt).toLocaleDateString()}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            Official Record
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-500 block mb-1">Subjective (Symptoms)</span>
                          <p className="text-slate-800">{note.subjective}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-500 block mb-1">Objective (Physical Exam)</span>
                          <p className="text-slate-800">{note.objective}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-sky-700 block mb-1">Assessment & Diagnosis</span>
                          <p className="text-slate-900 font-bold">{note.assessment}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-emerald-700 block mb-1">Management Plan</span>
                          <p className="text-slate-800">{note.plan}</p>
                        </div>
                      </div>

                      {note.dischargeInstructions && (
                        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900">
                          <span className="font-bold text-purple-800 block mb-1">Discharge Instructions</span>
                          <p>{note.dischargeInstructions}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostic Laboratory & Imaging Orders */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <Activity className="h-4 w-4 text-sky-600" />
                <span>Laboratory & Diagnostic Reports</span>
              </h3>

              {labOrders.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">No laboratory or imaging orders recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {labOrders.map((lab) => (
                    <div
                      key={lab.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900">{lab.testName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 uppercase">
                            {lab.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              lab.priority === 'STAT'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {lab.priority}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Ordered by {lab.doctorName} on {new Date(lab.orderedAt).toLocaleDateString()}
                        </div>
                        {lab.result && (
                          <div className="mt-2 text-xs font-mono p-2 bg-white rounded-lg border border-slate-200 text-slate-800">
                            Result: <span className="text-sky-700 font-bold">{lab.result}</span>{' '}
                            {lab.normalRange && (
                              <span className="text-slate-500">(Ref: {lab.normalRange})</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            lab.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {lab.status === 'completed' ? 'Resulted' : 'In Lab Queue'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: PRESCRIPTIONS ===================== */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Prescription & Medication Tracker</h2>
                <p className="text-xs text-slate-500">
                  Track active medications, daily intake compliance, and explore AI pharmacology guidance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMedModal(true)}
                className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors flex items-center space-x-2 shadow-xs shrink-0 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Medication / Vitamin</span>
              </button>
            </div>

            {/* Quick Add Presets Bar */}
            <div className="bg-teal-50/50 border border-teal-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-teal-900 flex items-center space-x-1.5 text-[11px] uppercase tracking-wider">
                <Zap className="h-3.5 w-3.5 text-teal-600" />
                <span>1-Click Popular Additions:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddMedPreset('Vitamin D3', '2000 IU', 'Once daily with meal', 'Support immune health and bone density.')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold cursor-pointer"
                >
                  + Vitamin D3 2000IU
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMedPreset('Omega-3 Fish Oil', '1000 mg', 'Once daily with dinner', 'Take with food for cardiovascular wellness.')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold cursor-pointer"
                >
                  + Omega-3 1000mg
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMedPreset('Daily Multivitamin', '1 tablet', 'Once daily in morning', 'General daily nutrient supplement.')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold cursor-pointer"
                >
                  + Multivitamin Daily
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMedPreset('Metformin HCl', '500 mg', 'Twice daily with meals', 'Take with breakfast and dinner.')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold cursor-pointer"
                >
                  + Metformin 500mg
                </button>
              </div>
            </div>

            {prescriptions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                <Pill className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Prescriptions</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Track your daily medications, vitamins, or clinic-issued prescriptions here with automated intake instructions and compliance tracking.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(true)}
                  className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Your First Medication / Vitamin</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {prescriptions.map((med, medIdx) => {
                  const today = new Date().toISOString().split('T')[0];
                  const slots = parseFrequencyToSlots(med.frequency);
                  const takenSlotsCount = slots.filter((slot) =>
                    med.adherenceLogs?.some(
                      (l) => l.date === today && (l.slotIndex ?? 0) === slot.index && l.taken
                    )
                  ).length;
                  const totalSlotsCount = slots.length;
                  const medCompliancePct = Math.round((takenSlotsCount / totalSlotsCount) * 100);

                  return (
                    <div
                      key={`${med.id || 'rx'}_${medIdx}`}
                      className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-bold text-slate-900">{med.medication}</span>
                          <button
                            type="button"
                            onClick={() => handleExplainMedication(med)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 flex items-center space-x-1 cursor-pointer transition-colors"
                          >
                            <Sparkles className="h-3 w-3 text-teal-600" />
                            <span>Ask AI Explainer</span>
                          </button>
                        </div>

                        <div className="text-xs font-bold text-teal-700 flex items-center space-x-1.5">
                          <span>{med.dosage}</span>
                          <span>·</span>
                          <span>{med.route}</span>
                          <span>·</span>
                          <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-200 text-[11px]">
                            {med.frequency}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mt-3 space-y-1.5 text-xs text-slate-700">
                          <div>
                            <span className="text-slate-500 font-semibold">Instructions:</span>{' '}
                            <span>{med.instructions}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold">Course Duration:</span>{' '}
                            <span>{med.duration}</span>
                          </div>
                          {med.precautions && (
                            <div className="text-amber-800 text-[11px] pt-1 border-t border-slate-200">
                              ⚠️ <span className="font-bold">Precaution:</span> {med.precautions}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Today's Tablet Dosing Schedule (Discrete Doses) */}
                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5 text-teal-600" />
                            <span>Today's Tablet Doses ({totalSlotsCount} Daily):</span>
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              medCompliancePct === 100
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : medCompliancePct > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {takenSlotsCount} of {totalSlotsCount} Taken ({medCompliancePct}%)
                          </span>
                        </div>

                        {/* Individual Tablet Slot Buttons */}
                        <div className="space-y-2">
                          {slots.map((slot, sIdx) => {
                            const isSlotTaken = !!med.adherenceLogs?.some(
                              (l) => l.date === today && (l.slotIndex ?? 0) === slot.index && l.taken
                            );
                            const slotLog = med.adherenceLogs?.find(
                              (l) => l.date === today && (l.slotIndex ?? 0) === slot.index && l.taken
                            );

                            return (
                              <div
                                key={`${med.id || 'rx'}_slot_${slot.index}_${sIdx}`}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                  isSlotTaken
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  {slot.period === 'morning' ? (
                                    <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                                  ) : (
                                    <Moon className="h-4 w-4 text-indigo-500 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-bold flex items-center space-x-1.5">
                                      <span>{slot.tabletLabel}</span>
                                      <span className="text-[10px] text-slate-500 font-normal">({slot.time})</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {slot.timingHint}
                                      {isSlotTaken && slotLog?.takenAt && (
                                        <span className="text-emerald-700 font-semibold ml-1">
                                          · Taken at {slotLog.takenAt}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0">
                                  {isSlotTaken ? (
                                    <div className="flex items-center space-x-1">
                                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center space-x-1">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                        <span>Taken</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSlot(med.id, slot.index, slot.name)}
                                        title="Undo dose"
                                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSlot(med.id, slot.index, slot.name)}
                                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center space-x-1 shadow-xs cursor-pointer transition-colors"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Mark Taken</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Appointment Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowBookingModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Book Clinic Appointment</h3>
                <p className="text-xs text-slate-500">Connect with an in-network hospital physician</p>
              </div>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Physician or Department
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                >
                  <option value="">Hospital Outpatient Clinic (Next Available Specialist)</option>
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.specialty || 'Physician'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Slot
                  </label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:30 PM">03:30 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Visit / Primary Complaint
                </label>
                <input
                  type="text"
                  required
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="e.g. Annual cardiac review, persistent joint pain, follow-up"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Include any recent medication changes or prior symptoms..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppointmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-slate-800">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reschedule Appointment</h3>
            <p className="text-xs text-slate-500 mb-4">Pick a new date and time for your consultation.</p>

            <form onSubmit={handleConfirmReschedule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Time Slot</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="04:00 PM">04:00 PM</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleAppointmentId(null)}
                  className="w-1/2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                >
                  Update Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Medication Explainer Modal */}
      {selectedMedication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => {
                setSelectedMedication(null);
                setMedExplanation(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedMedication.medication}</h3>
                <p className="text-xs text-teal-700 font-semibold">
                  {selectedMedication.dosage} · AI Pharmacology & Safety Guide
                </p>
              </div>
            </div>

            {isLoadingMedExplanation ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="h-6 w-6 text-teal-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Consulting clinical pharmacology engine...</p>
              </div>
            ) : medExplanation ? (
              <div className="space-y-4 text-xs">
                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-200">
                  <span className="font-bold text-teal-800 block mb-1">What This Medication Does</span>
                  <p className="text-slate-700 leading-relaxed">
                    {medExplanation.plainLanguageSummary}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">How & When to Take</span>
                  <p className="text-slate-700 leading-relaxed">{medExplanation.howToTake}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                    <span className="font-bold text-amber-800 block mb-1.5">Common Side Effects</span>
                    <ul className="space-y-1 text-slate-700">
                      {medExplanation.commonSideEffects.map((side, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{side}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200">
                    <span className="font-bold text-rose-800 block mb-1.5">Precautions & Warnings</span>
                    <ul className="space-y-1 text-slate-700">
                      {medExplanation.precautionsAndWarnings.map((warn, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-rose-600 font-bold">•</span>
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 1-Click Quick Vitals Logging Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowVitalsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Log Daily Vitals</h3>
                <p className="text-xs text-slate-500">Record your readings for automated health status tracking</p>
              </div>
            </div>

            <form onSubmit={handleSaveVitals} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Blood Pressure (Systolic/Diastolic)
                </label>
                <input
                  type="text"
                  required
                  value={logBP}
                  onChange={(e) => setLogBP(e.target.value)}
                  placeholder="e.g. 120/80"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-sky-500"
                />
                <span className="text-[10px] text-slate-400">Normal healthy range is around 120/80 mmHg</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    required
                    value={logHeartRate}
                    onChange={(e) => setLogHeartRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Glucose (mg/dL)</label>
                  <input
                    type="number"
                    required
                    value={logBloodSugar}
                    onChange={(e) => setLogBloodSugar(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={logTemp}
                    onChange={(e) => setLogTemp(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save & Analyze (1-Click)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Home Medication / Vitamin Modal */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowAddMedModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Add Medication or Vitamin</h3>
                <p className="text-xs text-slate-500">Track daily intake compliance & safety instructions</p>
              </div>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medication / Vitamin Name
                </label>
                <input
                  type="text"
                  required
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="e.g. Vitamin D3, Metformin, Lisinopril"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dosage / Strength</label>
                  <input
                    type="text"
                    required
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    placeholder="e.g. 1000 IU, 500 mg"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={newMedFrequency}
                    onChange={(e) => setNewMedFrequency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-500"
                  >
                    <option value="Once daily in the morning">Once daily (AM)</option>
                    <option value="Once daily in the evening">Once daily (PM)</option>
                    <option value="Twice daily with meals">Twice daily</option>
                    <option value="Every 8 hours as needed">Every 8 hours PRN</option>
                    <option value="Weekly">Once weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Intake Instructions / Notes
                </label>
                <input
                  type="text"
                  value={newMedInstructions}
                  onChange={(e) => setNewMedInstructions(e.target.value)}
                  placeholder="e.g. Take with food or glass of water."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-500"
                />
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Add to My Chart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
