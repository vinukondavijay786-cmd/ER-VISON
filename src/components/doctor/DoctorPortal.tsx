import React, { useState, useEffect } from 'react';
import {
  User,
  PatientRecord,
  DoctorClinicalNote,
  LabOrder,
  PrescriptionItem,
} from '../../types';
import { storage } from '../../services/storage';
import {
  aiService,
  ClinicalCdsResult,
  MedicalNoteResult,
  PatientTreatmentPlan,
  DoctorConsultResult,
} from '../../services/aiService';
import {
  Stethoscope,
  Activity,
  FileText,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  TestTubes,
  ChevronRight,
  ShieldAlert,
  Plus,
  X,
  RefreshCw,
  BedDouble,
  User as UserIcon,
  Zap,
  ArrowRight,
  Search,
  Printer,
  Pill,
  Heart,
  Send,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';

interface DoctorPortalProps {
  user: User;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'chart' | 'orders' | 'notes'>('queue');

  // Patients & Selected Patient
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  // Signed clinical notes archive & search
  const [signedNotes, setSignedNotes] = useState<DoctorClinicalNote[]>([]);
  const [notesSearchQuery, setNotesSearchQuery] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // AI Clinical Treatment Plan ("What To Do For The Patient") State
  const [treatmentPlan, setTreatmentPlan] = useState<PatientTreatmentPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [planAppliedSuccess, setPlanAppliedSuccess] = useState(false);
  const [consultQuery, setConsultQuery] = useState('');
  const [consultAnswer, setConsultAnswer] = useState<DoctorConsultResult | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);

  // AI Clinical Decision Support (CDS) State
  const [cdsResult, setCdsResult] = useState<ClinicalCdsResult | null>(null);
  const [isLoadingCDS, setIsLoadingCDS] = useState(false);
  const [proposedMedInput, setProposedMedInput] = useState('');

  // AI Medical Note & Discharge Generator State
  const [shorthandNotes, setShorthandNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<MedicalNoteResult | null>(null);

  // Editable SOAP fields
  const [soapSubjective, setSoapSubjective] = useState('');
  const [soapObjective, setSoapObjective] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [dischargeInstructions, setDischargeInstructions] = useState('');
  const [prescriptionsList, setPrescriptionsList] = useState<PrescriptionItem[]>([]);

  // Lab & Diagnostic Orders State
  const [allLabOrders, setAllLabOrders] = useState<LabOrder[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [newOrderTestName, setNewOrderTestName] = useState('High-Sensitivity Troponin I');
  const [newOrderCategory, setNewOrderCategory] = useState<LabOrder['category']>('cardiac');
  const [newOrderPriority, setNewOrderPriority] = useState<LabOrder['priority']>('STAT');

  // Enter Result Modal
  const [orderToResult, setOrderToResult] = useState<LabOrder | null>(null);
  const [resultInput, setResultInput] = useState('');
  const [referenceRangeInput, setReferenceRangeInput] = useState('');

  // Status Notification
  const [signedSuccess, setSignedSuccess] = useState(false);

  // Generate AI Treatment Plan for the patient's problem
  const handleGenerateTreatmentPlan = async (patientToAnalyze?: PatientRecord) => {
    const p = patientToAnalyze || selectedPatient;
    if (!p) return;
    setIsLoadingPlan(true);
    setPlanAppliedSuccess(false);

    try {
      const plan = await aiService.getPatientTreatmentPlan({
        patient: p,
        chiefComplaint: p.chiefComplaint,
        vitals: p.currentVitals,
        allergies: p.allergies,
        medicalHistory: p.medicalHistory,
        currentMeds: proposedMedInput ? proposedMedInput.split(',').map((s) => s.trim()) : [],
        userId: user.id,
      });

      setTreatmentPlan(plan);
    } catch (err) {
      console.warn('Failed to generate treatment plan:', err);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // 1-Click Order All Recommended Diagnostic Tests
  const handle1ClickOrderAllTests = (tests: PatientTreatmentPlan['recommendedOrders']) => {
    if (!selectedPatient || !tests || tests.length === 0) return;
    tests.forEach((test) => {
      const newOrder: LabOrder = {
        id: 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
        patientId: selectedPatient.id,
        patientMrn: selectedPatient.mrn,
        patientName: selectedPatient.fullName,
        doctorId: user.id,
        doctorName: user.name,
        testName: test.testName,
        category: test.category as any,
        priority: test.priority,
        status: 'ordered',
        orderedAt: new Date().toISOString(),
      };
      storage.saveLabOrder(newOrder);
    });
    setAllLabOrders(storage.getLabOrders());
  };

  // Order single recommended test
  const handleOrderSingleTest = (test: PatientTreatmentPlan['recommendedOrders'][0]) => {
    if (!selectedPatient) return;
    const newOrder: LabOrder = {
      id: 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
      patientId: selectedPatient.id,
      patientMrn: selectedPatient.mrn,
      patientName: selectedPatient.fullName,
      doctorId: user.id,
      doctorName: user.name,
      testName: test.testName,
      category: test.category as any,
      priority: test.priority,
      status: 'ordered',
      orderedAt: new Date().toISOString(),
    };
    storage.saveLabOrder(newOrder);
    setAllLabOrders(storage.getLabOrders());
  };

  // 1-Click Add All Recommended Medications to Prescription List
  const handle1ClickAddAllMedications = (meds: PatientTreatmentPlan['recommendedMedications']) => {
    if (!meds || meds.length === 0) return;
    setPrescriptionsList((prev) => {
      const updated = [...prev];
      meds.forEach((m) => {
        const alreadyExists = updated.some(
          (p) => p.medication.trim().toLowerCase() === m.medication.trim().toLowerCase()
        );
        if (!alreadyExists) {
          updated.push({
            id: 'rx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
            medication: m.medication,
            dosage: m.dosage,
            frequency: m.frequency,
            route: m.route,
            duration: m.duration,
            instructions: m.instructions,
            precautions: m.precautions,
          });
        }
      });
      return updated;
    });
  };

  // Add single recommended medication
  const handleAddSingleMedication = (m: PatientTreatmentPlan['recommendedMedications'][0]) => {
    setPrescriptionsList((prev) => {
      const alreadyExists = prev.some(
        (p) => p.medication.trim().toLowerCase() === m.medication.trim().toLowerCase()
      );
      if (alreadyExists) return prev;
      return [
        ...prev,
        {
          id: 'rx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          medication: m.medication,
          dosage: m.dosage,
          frequency: m.frequency,
          route: m.route,
          duration: m.duration,
          instructions: m.instructions,
          precautions: m.precautions,
        },
      ];
    });
  };

  // 1-Click Apply AI Care Plan to SOAP Documentation & Prescriptions
  const handleApplyPlanToSOAP = () => {
    if (!treatmentPlan) return;
    setSoapSubjective(treatmentPlan.soapDraft.subjective);
    setSoapObjective(treatmentPlan.soapDraft.objective);
    setSoapAssessment(treatmentPlan.soapDraft.assessment);
    setSoapPlan(treatmentPlan.soapDraft.plan);
    setDischargeInstructions(treatmentPlan.counselingAndDischargeAdvice);
    if (treatmentPlan.recommendedMedications && treatmentPlan.recommendedMedications.length > 0) {
      handle1ClickAddAllMedications(treatmentPlan.recommendedMedications);
    }
    setPlanAppliedSuccess(true);
  };

  // Interactive Doctor Consult Query
  const handleDoctorConsult = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const q = (customQuestion || consultQuery).trim();
    if (!selectedPatient || !q) return;
    setIsConsulting(true);
    try {
      const res = await aiService.askDoctorConsult({
        patient: selectedPatient,
        question: q,
        vitals: selectedPatient.currentVitals,
        allergies: selectedPatient.allergies,
        medicalHistory: selectedPatient.medicalHistory,
        userId: user.id,
      });
      setConsultAnswer(res);
      setConsultQuery(q);
    } catch (err) {
      console.warn('Consult error:', err);
    } finally {
      setIsConsulting(false);
    }
  };

  const loadData = () => {
    const loadedPatients = storage.getPatients();
    // Sort by priority heap score descending
    loadedPatients.sort((a, b) => b.priorityScore - a.priorityScore);
    setPatients(loadedPatients);

    if (!selectedPatientId && loadedPatients.length > 0) {
      setSelectedPatientId(loadedPatients[0].id);
    }

    setAllLabOrders(storage.getLabOrders());
    setSignedNotes(storage.getClinicalNotes());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentP = patients.find((p) => p.id === selectedPatientId);
    if (currentP) {
      setCdsResult(null);
      setGeneratedNotes(null);
      setSignedSuccess(false);
      setPlanAppliedSuccess(false);
      setConsultAnswer(null);
      setConsultQuery('');
      setShorthandNotes(
        `${currentP.fullName}, presented with ${currentP.chiefComplaint}. Vitals: HR ${currentP.currentVitals.heartRate}, BP ${currentP.currentVitals.systolicBP}/${currentP.currentVitals.diastolicBP}. Exam shows acute distress requiring structured clinical intervention.`
      );
      // Auto-generate AI treatment plan for patient presentation
      handleGenerateTreatmentPlan(currentP);
    }
  }, [selectedPatientId, patients.length]);

  // Run AI Clinical Decision Support (CDS)
  const handleRunCDS = async () => {
    if (!selectedPatient) return;
    setIsLoadingCDS(true);

    const proposedMeds = proposedMedInput
      ? proposedMedInput.split(',').map((s) => s.trim())
      : [];

    const result = await aiService.getClinicalCds({
      patient: selectedPatient,
      chiefComplaint: selectedPatient.chiefComplaint,
      vitals: selectedPatient.currentVitals,
      allergies: selectedPatient.allergies,
      medicalHistory: selectedPatient.medicalHistory,
      currentMeds: proposedMeds,
      userId: user.id,
    });

    setCdsResult(result);
    setIsLoadingCDS(false);
  };

  // Run AI Medical Note & Discharge Generator
  const handleGenerateMedicalNotes = async () => {
    if (!selectedPatient || !shorthandNotes.trim()) return;
    setIsGeneratingNotes(true);
    setSignedSuccess(false);

    const result = await aiService.generateMedicalNotes({
      shorthandNotes: shorthandNotes.trim(),
      patient: selectedPatient,
      vitals: selectedPatient.currentVitals,
      doctorName: user.name,
      specialty: user.specialty,
      userId: user.id,
    });

    setGeneratedNotes(result);
    setSoapSubjective(result.soapNote.subjective);
    setSoapObjective(result.soapNote.objective);
    setSoapAssessment(result.soapNote.assessment);
    setSoapPlan(result.soapNote.plan);
    setDischargeInstructions(result.dischargeInstructions);

    const mappedPrescriptions: PrescriptionItem[] = result.prescriptions.map((p) => ({
      id: 'rx_' + Math.random().toString(36).substring(2, 9),
      medication: p.medication,
      dosage: p.dosage,
      frequency: p.frequency,
      route: p.route,
      duration: p.duration,
      instructions: p.instructions,
      precautions: p.precautions,
    }));
    setPrescriptionsList(mappedPrescriptions);

    setIsGeneratingNotes(false);
  };

  // Sign and Finalize Medical Encounter Note
  const handleSignClinicalNote = () => {
    if (!selectedPatient) return;

    const existingNotes = storage.getClinicalNotesByPatient(selectedPatient.id);
    const existingSameNote = existingNotes.find(
      (n) =>
        n.doctorId === user.id &&
        ((n.assessment && n.assessment.trim().toLowerCase() === soapAssessment.trim().toLowerCase()) ||
          n.signedAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
    );

    const noteRecord: DoctorClinicalNote = {
      id: existingSameNote ? existingSameNote.id : 'note_' + Math.random().toString(36).substring(2, 9),
      patientId: selectedPatient.id,
      patientMrn: selectedPatient.mrn,
      patientName: selectedPatient.fullName,
      doctorId: user.id,
      doctorName: user.name,
      specialty: user.specialty || 'Attending Physician',
      subjective: soapSubjective,
      objective: soapObjective,
      assessment: soapAssessment,
      plan: soapPlan,
      differentialDiagnoses: cdsResult ? cdsResult.differentialDiagnoses.map((d) => d.condition) : [],
      dischargeInstructions,
      prescriptions: prescriptionsList,
      status: 'signed',
      signedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    storage.saveClinicalNote(noteRecord);

    selectedPatient.status = 'with_doctor';
    selectedPatient.assignedDoctorId = user.id;
    selectedPatient.assignedDoctorName = user.name;
    storage.savePatient(selectedPatient);

    setSignedSuccess(true);
    setPrescriptionsList([]);
    loadData();
  };

  // Create Lab Order
  const handleCreateLabOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newOrderTestName.trim()) return;

    const newOrder: LabOrder = {
      id: 'ord_' + Math.random().toString(36).substring(2, 9),
      patientId: selectedPatient.id,
      patientMrn: selectedPatient.mrn,
      patientName: selectedPatient.fullName,
      doctorId: user.id,
      doctorName: user.name,
      testName: newOrderTestName.trim(),
      category: newOrderCategory,
      priority: newOrderPriority,
      status: 'ordered',
      orderedAt: new Date().toISOString(),
    };

    storage.saveLabOrder(newOrder);
    setShowOrderModal(false);
    loadData();
  };

  // Result Lab Order
  const handleResultLabOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToResult || !resultInput.trim()) return;

    orderToResult.result = resultInput.trim();
    orderToResult.normalRange = referenceRangeInput.trim() || 'Normal Range';
    orderToResult.status = 'completed';
    orderToResult.resultedAt = new Date().toISOString();

    storage.saveLabOrder(orderToResult);
    setOrderToResult(null);
    setResultInput('');
    setReferenceRangeInput('');
    loadData();
  };

  // 1-Click Next Urgent Patient
  const handleSelectNextPriorityPatient = () => {
    if (patients.length === 0) return;
    const topPatient = patients[0];
    setSelectedPatientId(topPatient.id);
    setActiveTab('chart');
  };

  // 1-Click STAT Lab Order Bundle
  const handle1ClickStatOrder = (bundleType: 'cardiac' | 'sepsis' | 'neuro') => {
    if (!selectedPatient) return;
    let testName = 'High-Sensitivity Troponin I & 12-Lead ECG';
    let category: LabOrder['category'] = 'cardiac';

    if (bundleType === 'sepsis') {
      testName = 'Serum Lactate, Blood Cultures x2 & CBC';
      category = 'hematology';
    } else if (bundleType === 'neuro') {
      testName = 'Non-Contrast CT Head & Coagulation Panel (PT/INR)';
      category = 'imaging';
    }

    const newOrder: LabOrder = {
      id: 'ord_' + Math.random().toString(36).substring(2, 9),
      patientId: selectedPatient.id,
      patientMrn: selectedPatient.mrn,
      patientName: selectedPatient.fullName,
      doctorId: user.id,
      doctorName: user.name,
      testName,
      category,
      priority: 'STAT',
      status: 'ordered',
      orderedAt: new Date().toISOString(),
    };

    storage.saveLabOrder(newOrder);
    loadData();
    setActiveTab('orders');
  };

  // 1-Click Direct CDS from Queue
  const handle1ClickDirectCDS = async (patient: PatientRecord) => {
    setSelectedPatientId(patient.id);
    setActiveTab('chart');
    setIsLoadingCDS(true);
    const result = await aiService.getClinicalCds({
      patient,
      chiefComplaint: patient.chiefComplaint,
      vitals: patient.currentVitals,
      allergies: patient.allergies,
      medicalHistory: patient.medicalHistory,
      currentMeds: [],
      userId: user.id,
    });
    setCdsResult(result);
    setIsLoadingCDS(false);
  };

  // 1-Click SOAP Scribe Template
  const handleApplyScribeTemplate = async (templateKey: 'acs' | 'asthma' | 'sepsis' | 'laceration') => {
    if (!selectedPatient) return;
    let noteText = '';
    if (templateKey === 'acs') {
      noteText = `Patient presenting with acute substernal chest pressure, radiating to left shoulder and jaw, associated with diaphoresis and dyspnea. Initial ECG shows sinus tachycardia with ST depression in anterolateral leads. Serial troponins and continuous telemetry ordered. Administered aspirin 324mg chewable, sublingual nitroglycerin, and titrating supplemental O2. Differential: ACS vs NSTEMI vs unstable angina. Plan: admission to Cardiology / CCU observation.`;
    } else if (templateKey === 'asthma') {
      noteText = `Acute exacerbation of moderate-to-severe asthma with wheezing and tachypnea. Peak flow decreased to 55% of predicted. Administered back-to-back albuterol/ipratropium nebulizer treatments and IV methylprednisolone 60mg. Improved air movement on lung auscultation with decreased accessory muscle use. Plan: observation for 3 hours, discharge with 5-day prednisone burst and renewed rescue inhaler.`;
    } else if (templateKey === 'sepsis') {
      noteText = `Patient meets severe sepsis criteria with fever >102°F, heart rate >120, and mean arterial pressure <65. Sepsis resuscitation bundle initiated. Ordered 30 mL/kg IV crystalloid fluid bolus, STAT blood cultures x2, serum lactate, and broad-spectrum empiric IV antibiotics (vancomycin + cefepime). Monitoring urine output and serial lactates Q2H.`;
    } else {
      noteText = `Patient sustained full-thickness linear laceration on forearm from sharp edge. Neuromuscular exam reveals intact sensation, distal pulses 2+, and full active range of motion without tendon compromise. Wound irrigated with 500 mL sterile normal saline under local lidocaine 1% with epinephrine anesthesia. Repaired with simple interrupted 4-0 nylon sutures. Tetanus toxoid booster administered. Discharge with wound care precautions.`;
    }

    setShorthandNotes(noteText);
    setIsGeneratingNotes(true);
    setSignedSuccess(false);

    const result = await aiService.generateMedicalNotes({
      shorthandNotes: noteText,
      patient: selectedPatient,
      vitals: selectedPatient.currentVitals,
      doctorName: user.name,
      specialty: user.specialty,
      userId: user.id,
    });

    setGeneratedNotes(result);
    setSoapSubjective(result.soapNote.subjective);
    setSoapObjective(result.soapNote.objective);
    setSoapAssessment(result.soapNote.assessment);
    setSoapPlan(result.soapNote.plan);
    setDischargeInstructions(result.dischargeInstructions);

    const mappedPrescriptions: PrescriptionItem[] = result.prescriptions.map((p) => ({
      id: 'rx_' + Math.random().toString(36).substring(2, 9),
      medication: p.medication,
      dosage: p.dosage,
      frequency: p.frequency,
      route: p.route,
      duration: p.duration,
      instructions: p.instructions,
      precautions: p.precautions,
    }));
    setPrescriptionsList(mappedPrescriptions);
    setIsGeneratingNotes(false);
  };

  // 1-Click Fast Doctor Patient Creator (for seamless clinical testing)
  const handleDoctorCreateQuickPatient = (type: 'acs' | 'sepsis') => {
    const recordedAt = new Date().toISOString();
    const isAcs = type === 'acs';

    const vitals = isAcs
      ? {
          heartRate: 104,
          systolicBP: 152,
          diastolicBP: 94,
          o2Sat: 94,
          temperature: 98.6,
          respRate: 22,
          painScore: 9,
          consciousness: 'Alert' as const,
          recordedAt,
        }
      : {
          heartRate: 126,
          systolicBP: 86,
          diastolicBP: 52,
          o2Sat: 91,
          temperature: 103.1,
          respRate: 28,
          painScore: 4,
          consciousness: 'Voice' as const,
          recordedAt,
        };

    const newPatient: PatientRecord = {
      id: 'pt_' + Math.random().toString(36).substring(2, 9),
      mrn: `PC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      fullName: isAcs ? 'Gregory Vance' : 'Clara Henderson',
      dob: isAcs ? '1965-08-14' : '1952-11-03',
      gender: isAcs ? 'male' : 'female',
      arrivalMode: 'ambulance',
      chiefComplaint: isAcs
        ? 'Severe substernal crushing chest pressure radiating to neck and shoulder for 1 hour'
        : 'High-grade fever, chills, confusion, altered mental status, and low blood pressure',
      allergies: isAcs ? ['Aspirin (Mild)'] : ['Penicillin (Hives)'],
      medicalHistory: isAcs ? ['Hypertension', 'Hyperlipidemia'] : ['Type 2 Diabetes', 'Chronic Kidney Disease'],
      triageNotes: isAcs
        ? 'Immediate telemetry and 12-lead ECG required.'
        : 'SIRS criteria positive. Fluid resuscitation required.',
      triageTime: recordedAt,
      acuityLevel: isAcs ? 2 : 1,
      currentVitals: vitals,
      vitalsHistory: [vitals],
      mewsScore: isAcs ? 3 : 6,
      priorityScore: isAcs ? 85 : 98,
      status: 'waiting',
      assignedDoctorId: user.id,
      assignedDoctorName: user.name,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };

    storage.savePatient(newPatient);
    loadData();
    setSelectedPatientId(newPatient.id);
    setActiveTab('chart');
  };

  // 1-Click Status Stepper for Physician
  const handleCycleDoctorPatientStatus = (patient: PatientRecord) => {
    const nextStatusMap: Record<PatientRecord['status'], PatientRecord['status']> = {
      waiting: 'in_triage',
      in_triage: 'assigned_bed',
      assigned_bed: 'with_doctor',
      with_doctor: 'admitted',
      admitted: 'discharged',
      discharged: 'with_doctor',
    };
    patient.status = nextStatusMap[patient.status] || 'with_doctor';
    patient.updatedAt = new Date().toISOString();
    storage.savePatient(patient);
    loadData();
  };

  // 1-Click Fast Prescription Preset
  const handle1ClickPrescription = (medKey: 'amox' | 'ibu' | 'lisinopril' | 'albuterol') => {
    const presets: Record<string, PrescriptionItem> = {
      amox: {
        id: 'rx_' + Math.random().toString(36).substring(2, 9),
        medication: 'Amoxicillin-Clavulanate (Augmentin)',
        dosage: '875/125 mg',
        frequency: 'Twice daily with meals',
        route: 'Oral',
        duration: '7 days',
        instructions: 'Take with food to prevent GI upset. Complete full course.',
        precautions: 'Report severe watery diarrhea or rash immediately.',
      },
      ibu: {
        id: 'rx_' + Math.random().toString(36).substring(2, 9),
        medication: 'Ibuprofen',
        dosage: '600 mg',
        frequency: 'Every 8 hours as needed',
        route: 'Oral',
        duration: '5 days',
        instructions: 'Take with full glass of water and food.',
        precautions: 'Do not exceed 2400mg daily. Avoid alcohol.',
      },
      lisinopril: {
        id: 'rx_' + Math.random().toString(36).substring(2, 9),
        medication: 'Lisinopril',
        dosage: '10 mg',
        frequency: 'Once daily in the morning',
        route: 'Oral',
        duration: '30 days',
        instructions: 'Monitor blood pressure weekly. Stay hydrated.',
        precautions: 'Report dry cough or lip swelling immediately.',
      },
      albuterol: {
        id: 'rx_' + Math.random().toString(36).substring(2, 9),
        medication: 'Albuterol Sulfate HFA Inhaler',
        dosage: '90 mcg/actuation',
        frequency: '1-2 puffs every 4-6 hours PRN',
        route: 'Inhalation',
        duration: '30 days',
        instructions: 'Use spacer if available. Rinse mouth after use.',
        precautions: 'Seek emergency care if symptoms do not improve after 2 doses.',
      },
    };

    const chosen = presets[medKey];
    if (chosen) {
      setPrescriptionsList((prev) => {
        const alreadyExists = prev.some(
          (p) => p.medication.trim().toLowerCase() === chosen.medication.trim().toLowerCase()
        );
        if (alreadyExists) return prev;
        const uniquePrescription: PrescriptionItem = {
          ...chosen,
          id: 'rx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9),
        };
        return [...prev, uniquePrescription];
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 pb-16">
      {/* Navigation Sub-header */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex space-x-1 sm:space-x-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'queue'
                    ? 'bg-sky-50 text-sky-800 border border-sky-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Activity className="h-4 w-4 text-sky-600" />
                <span>Urgent Clinical Queue ({patients.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'chart'
                    ? 'bg-purple-50 text-purple-800 border border-purple-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Stethoscope className="h-4 w-4 text-purple-600" />
                <span>
                  Clinical Chart & CDS {selectedPatient ? `(${selectedPatient.fullName})` : ''}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'orders'
                    ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TestTubes className="h-4 w-4 text-teal-600" />
                <span>STAT Diagnostic Orders ({allLabOrders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'notes'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Signed Clinical Records ({signedNotes.length})</span>
              </button>
            </div>

            {selectedPatient && (
              <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                <span className="text-slate-500">Active Patient:</span>
                <span className="font-bold text-slate-900">{selectedPatient.fullName}</span>
                <span className="font-mono text-sky-700 text-[11px] font-semibold">{selectedPatient.mrn}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ===================== TAB 1: URGENT CLINICAL QUEUE ===================== */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-sky-600" />
                  <span>Physician Worklist: Urgent Clinical Queue</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Select an assigned or waiting patient to review their chart, run AI differential CDS, and generate discharge notes.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold shadow-xs">
                  Physician Specialty: <strong className="text-sky-700">{user.specialty || 'General Medicine'}</strong>
                </span>
              </div>
            </div>

            {/* ================= CLICK & DO MY WORK: FAST PHYSICIAN COMMAND BAR ================= */}
            <div className="bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/60 border border-sky-200/90 rounded-3xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-sky-100 gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      1-Click Physician Action Center
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Click below to immediately evaluate the highest-urgency patient or order STAT diagnostic bundles.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectNextPriorityPatient}
                    disabled={patients.length === 0}
                    className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs transition-all flex items-center space-x-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Next Urgent Patient (1-Click)</span>
                  </button>
                </div>
              </div>

              {/* STAT Lab Bundles (1-Click) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  1-Click STAT Order Sets:
                </span>
                <button
                  type="button"
                  onClick={() => handle1ClickStatOrder('cardiac')}
                  disabled={!selectedPatient}
                  className="py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>🫀 STAT Cardiac Triad (Trop + ECG + BMP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickStatOrder('sepsis')}
                  disabled={!selectedPatient}
                  className="py-1.5 px-3 rounded-xl bg-white hover:bg-orange-50 text-slate-800 hover:text-orange-700 border border-slate-200 hover:border-orange-300 text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>🔥 STAT Sepsis Bundle (Lactate + Blood Cx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickStatOrder('neuro')}
                  disabled={!selectedPatient}
                  className="py-1.5 px-3 rounded-xl bg-white hover:bg-purple-50 text-slate-800 hover:text-purple-700 border border-slate-200 hover:border-purple-300 text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>🧠 STAT Neuro CT Stroke Workup</span>
                </button>
              </div>
            </div>

            {patients.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                <Stethoscope className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Patients in Worklist</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Patients registered via the Nurse Portal or Emergency Intake will dynamically populate this queue sorted by clinical severity.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDoctorCreateQuickPatient('acs')}
                    className="py-2 px-3.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    1-Click Load Acute Chest Pain Case
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDoctorCreateQuickPatient('sepsis')}
                    className="py-2 px-3.5 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    1-Click Load Sepsis Resus Case
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patients.map((patient) => {
                  const isSelected = patient.id === selectedPatientId;
                  const isCritical = patient.acuityLevel <= 2;

                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setActiveTab('chart');
                      }}
                      className={`bg-white border rounded-3xl p-5 shadow-xs cursor-pointer transition-all hover:shadow-md hover:border-sky-300 flex flex-col justify-between ${
                        isSelected
                          ? 'border-sky-500 ring-2 ring-sky-100'
                          : isCritical
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-sky-700">
                              {patient.mrn}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                patient.acuityLevel === 1
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : patient.acuityLevel === 2
                                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              ESI Level {patient.acuityLevel}
                            </span>
                          </div>

                          {patient.assignedBedName && (
                            <span className="text-[11px] font-bold text-teal-700 flex items-center space-x-1">
                              <BedDouble className="h-3.5 w-3.5" />
                              <span>{patient.assignedBedName}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{patient.fullName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {patient.gender}, {patient.dob} · Arrival: {patient.arrivalMode}
                        </p>

                        <div className="mt-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700">
                          <span className="text-slate-500 font-semibold">Chief Complaint:</span>{' '}
                          {patient.chiefComplaint}
                        </div>

                        {/* Vitals Bar */}
                        <div className="grid grid-cols-4 gap-2 mt-3 text-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">HR</span>
                            <span className="font-bold text-slate-900">{patient.currentVitals.heartRate} bpm</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">BP</span>
                            <span className="font-bold text-slate-900">
                              {patient.currentVitals.systolicBP}/{patient.currentVitals.diastolicBP}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">SpO2</span>
                            <span className="font-bold text-sky-700">{patient.currentVitals.o2Sat}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Temp</span>
                            <span className="font-bold text-slate-900">{patient.currentVitals.temperature}°F</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500 font-mono text-[11px]">MEWS: {patient.mewsScore}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCycleDoctorPatientStatus(patient);
                            }}
                            title="Click to advance clinical status"
                            className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 uppercase tracking-wider cursor-pointer"
                          >
                            {patient.status.replace(/_/g, ' ')}
                          </button>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatientId(patient.id);
                              setActiveTab('chart');
                              handleGenerateTreatmentPlan(patient);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white text-xs font-bold flex items-center space-x-1 transition-all shadow-xs cursor-pointer"
                            title="Open chart and get immediate AI suggestions on what to do for this patient's problem"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>What To Do (AI Plan)</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handle1ClickDirectCDS(patient);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <Activity className="h-3 w-3" />
                            <span>AI CDS</span>
                          </button>

                          <span className="text-sky-600 font-bold flex items-center space-x-1 pl-1">
                            <span>Open Chart</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: CLINICAL CHART & AI CDS ===================== */}
        {activeTab === 'chart' && (
          <div className="space-y-6">
            {!selectedPatient ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                <Stethoscope className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Chart Selected</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Please select a patient from the Urgent Clinical Queue or click below to evaluate the highest-urgency waiting patient.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleSelectNextPriorityPatient}
                    disabled={patients.length === 0}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl text-xs font-bold text-white shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Quick Select Highest Urgency Patient</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('queue')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Return to Worklist
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sign Success Notification */}
                {signedSuccess && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-5 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Clinical Encounter Note Successfully Signed & Committed!
                        </div>
                        <div className="text-xs text-emerald-700 mt-0.5">
                          Official SOAP note, differential diagnoses, and prescriptions are now archived and synchronized to the patient record.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setSignedSuccess(false);
                          setActiveTab('notes');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>View in Signed Archive →</span>
                      </button>
                      <button
                        onClick={() => setSignedSuccess(false)}
                        className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                        title="Dismiss notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Patient Banner */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-sky-700">{selectedPatient.mrn}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ESI Level {selectedPatient.acuityLevel}
                      </span>
                      {selectedPatient.assignedBedName && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {selectedPatient.assignedBedName}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedPatient.fullName}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedPatient.gender}, DOB: {selectedPatient.dob} · Allergies:{' '}
                      <span className="text-rose-600 font-bold">
                        {selectedPatient.allergies.length > 0 ? selectedPatient.allergies.join(', ') : 'NKDA'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowOrderModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Order STAT Labs</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('queue')}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
                    >
                      Switch Patient
                    </button>
                  </div>
                </div>

                {/* ===================== PRIMARY: AI CLINICAL CARE PROTOCOL ("WHAT TO DO FOR THIS PATIENT") ===================== */}
                <div className="bg-gradient-to-b from-white to-sky-50/40 border-2 border-teal-500/30 rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden space-y-6">
                  {/* Subtle background glow */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400/5 rounded-full blur-3xl pointer-events-none" />

                  {/* Header Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-200 gap-4">
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-teal-600 via-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 shrink-0">
                        <Sparkles className="h-6 w-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                            AI Clinical Care Protocol
                          </span>
                          {treatmentPlan && (
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                                treatmentPlan.urgencyLevel === 'Emergency' || treatmentPlan.urgencyLevel === 'High Urgency'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              Acuity: {treatmentPlan.urgencyLevel}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                          What To Do for {selectedPatient.fullName}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium">
                          Clinical problem presented to doctor:{' '}
                          <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            &ldquo;{selectedPatient.chiefComplaint}&rdquo;
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleApplyPlanToSOAP}
                        disabled={!treatmentPlan || isLoadingPlan}
                        className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-40"
                        title="Directly load the AI recommended treatment plan and medications into your SOAP documentation"
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>Apply AI Plan to SOAP & Orders (1-Click)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateTreatmentPlan(selectedPatient)}
                        disabled={isLoadingPlan}
                        className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-40"
                        title="Re-run AI clinical recommendation engine for this patient"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoadingPlan ? 'animate-spin text-teal-600' : ''}`} />
                        <span>{isLoadingPlan ? 'Synthesizing...' : 'Re-Analyze'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Plan Applied Alert */}
                  {planAppliedSuccess && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>
                          AI Care Plan has been successfully applied to your SOAP note fields and prescription list below! You can review or customize any field before signing.
                        </span>
                      </div>
                      <button
                        onClick={() => setPlanAppliedSuccess(false)}
                        className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Loading State */}
                  {isLoadingPlan && !treatmentPlan && (
                    <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                      <div className="h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <div className="text-sm font-bold text-slate-900">
                        Synthesizing Clinical Treatment Protocol...
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Evaluating presenting problem (&ldquo;{selectedPatient.chiefComplaint}&rdquo;), vital signs, and allergy constraints to generate tailored clinical directives.
                      </p>
                    </div>
                  )}

                  {/* Plan Content */}
                  {treatmentPlan && (
                    <div className="space-y-6">
                      {/* Clinical Summary Banner */}
                      <div className="p-4 rounded-2xl bg-white border border-teal-200/80 shadow-xs">
                        <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                          <Activity className="h-3.5 w-3.5" />
                          <span>Clinical Presentation & Problem Assessment</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                          {treatmentPlan.chiefComplaintSummary}
                        </p>
                      </div>

                      {/* 1. Immediate Bedside & Stabilization Steps */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                            <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                            <span>Immediate Bedside Steps (&ldquo;What To Do Right Now&rdquo;)</span>
                          </h4>
                          <span className="text-[11px] text-slate-500">Chronological Priority</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {treatmentPlan.immediateActions.map((action, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start space-x-3 hover:border-teal-300 transition-colors"
                            >
                              <div className="h-7 w-7 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                {action.priority || i + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-xs font-bold text-slate-900">{action.title}</span>
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    {action.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                  {action.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. Recommended Diagnostic Workup & Orders */}
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                            <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                            <span>Recommended Diagnostic Orders & Lab Workup</span>
                          </h4>

                          <button
                            type="button"
                            onClick={() => handle1ClickOrderAllTests(treatmentPlan.recommendedOrders)}
                            className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                            title="Place all recommended laboratory & imaging orders in one click"
                          >
                            <TestTubes className="h-3.5 w-3.5" />
                            <span>1-Click Order All Recommended Tests</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {treatmentPlan.recommendedOrders.map((order, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-2 hover:border-sky-300 transition-colors"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span
                                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      order.priority === 'STAT'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {order.priority}
                                  </span>
                                  <span className="text-[10px] text-slate-500 capitalize">{order.category}</span>
                                </div>
                                <div className="text-xs font-bold text-slate-900 leading-snug">{order.testName}</div>
                                <p className="text-[11px] text-slate-500 mt-1 leading-normal">{order.rationale}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOrderSingleTest(order)}
                                className="mt-2 py-1 px-2.5 rounded-lg bg-slate-50 hover:bg-sky-50 text-sky-700 border border-slate-200 hover:border-sky-300 text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Order This Test</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3. Recommended Pharmacotherapy & Prescriptions */}
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                              <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                              <span>Recommended Pharmacotherapy & Prescriptions</span>
                            </h4>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline-block">
                              Allergy Screened
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handle1ClickAddAllMedications(treatmentPlan.recommendedMedications)}
                            className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                            title="Add all recommended medications to the prescription list below"
                          >
                            <Pill className="h-3.5 w-3.5" />
                            <span>1-Click Add Medications to Plan</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {treatmentPlan.recommendedMedications.map((med, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-2 hover:border-emerald-300 transition-colors"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-black text-slate-900">{med.medication}</div>
                                    <div className="text-[11px] text-emerald-700 font-bold">
                                      {med.dosage} · {med.route} · {med.frequency}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                    {med.duration}
                                  </span>
                                </div>

                                <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                  <p><span className="font-semibold text-slate-700">Indication:</span> {med.indication}</p>
                                  <p><span className="font-semibold text-slate-700">Instructions:</span> {med.instructions}</p>
                                  {med.precautions && (
                                    <p className="text-amber-800 bg-amber-50/60 p-1.5 rounded-lg border border-amber-200/80 font-medium text-[10px]">
                                      ⚠️ {med.precautions}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddSingleMedication(med)}
                                className="mt-2 py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add to Prescriptions</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4. Differential Diagnoses & Key Rule-Out Tests */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                          <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-bold">4</span>
                          <span>Clinical Differential Diagnoses & Evidence Rule-Outs</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {treatmentPlan.differentialDiagnoses.map((diff, i) => (
                            <div key={i} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900">{diff.condition}</span>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    diff.probability === 'High'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : diff.probability === 'Moderate'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {diff.probability} Probability
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600">{diff.clinicalRationale}</p>
                              <div className="text-[10px] text-sky-800 font-semibold bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">
                                Key Confirmation / Rule-Out Test: <span className="font-bold">{diff.keyRuleOutTest}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 5. Patient Counseling & Deterioration Red Flags */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>Patient Counseling & Discharge Advice</span>
                          </h5>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {treatmentPlan.counselingAndDischargeAdvice}
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-xs space-y-1.5">
                          <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center space-x-1.5">
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                            <span>Clinical Red Flags & Escalation Triggers</span>
                          </h5>
                          <ul className="space-y-1 text-xs text-rose-800">
                            {treatmentPlan.redFlagsToWatch.map((flag, i) => (
                              <li key={i} className="flex items-start space-x-1.5">
                                <span className="font-bold text-rose-600">•</span>
                                <span>{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* 6. Interactive Doctor Clinical Consult Query Box */}
                      <div className="pt-2 border-t border-slate-200 space-y-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                            <Send className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900">
                              Ask AI Clinical Consult About This Patient
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              Need specific dosing, allergy alternatives, or scenario analysis for this problem? Ask below:
                            </p>
                          </div>
                        </div>

                        <form onSubmit={handleDoctorConsult} className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={consultQuery}
                            onChange={(e) => setConsultQuery(e.target.value)}
                            placeholder="e.g. Alternative antibiotic if penicillin allergy? Or pediatric dosing adjustment?"
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-xs"
                          />
                          <button
                            type="submit"
                            disabled={isConsulting || !consultQuery.trim()}
                            className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-40 cursor-pointer"
                          >
                            <Send className={`h-3.5 w-3.5 ${isConsulting ? 'animate-pulse' : ''}`} />
                            <span>{isConsulting ? 'Consulting...' : 'Get Clinical Answer'}</span>
                          </button>
                        </form>

                        {/* Quick Question Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400 font-bold">Quick Prompts:</span>
                          <button
                            type="button"
                            onClick={() => handleDoctorConsult(undefined, 'What is the safest alternative antibiotic given patient allergy history?')}
                            className="px-2 py-0.5 rounded-full bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 transition-colors cursor-pointer"
                          >
                            Allergy-safe alternatives
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDoctorConsult(undefined, 'What renal or geriatric dosage adjustments are indicated for this patient?')}
                            className="px-2 py-0.5 rounded-full bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 transition-colors cursor-pointer"
                          >
                            Dosage adjustments
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDoctorConsult(undefined, 'What is the expected clinical response timeline and next escalation step?')}
                            className="px-2 py-0.5 rounded-full bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 transition-colors cursor-pointer"
                          >
                            Response timeline
                          </button>
                        </div>

                        {/* Consult Answer Display */}
                        {consultAnswer && (
                          <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 text-xs text-slate-800 space-y-2 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-teal-900 uppercase text-[10px] tracking-wider">
                                Clinical Consult Assessment
                              </span>
                              <span className="text-[10px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200">
                                {consultAnswer.evidenceLevel}
                              </span>
                            </div>
                            <p className="leading-relaxed font-medium">{consultAnswer.answer}</p>
                            {consultAnswer.clinicalPearls && consultAnswer.clinicalPearls.length > 0 && (
                              <div className="pt-2 border-t border-teal-200/80 space-y-1">
                                <span className="text-[10px] font-bold text-teal-800 uppercase">Clinical Pearls:</span>
                                <ul className="list-disc list-inside text-[11px] text-teal-900 space-y-0.5">
                                  {consultAnswer.clinicalPearls.map((pearl, pi) => (
                                    <li key={pi}>{pearl}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section A: AI Clinical Decision Support (CDS) */}
                <div className="bg-white border border-purple-200 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">AI Differential Diagnoses & Allergy Screening (CDS)</h3>
                        <p className="text-xs text-slate-500">
                          Differential diagnoses, drug-allergy contraindication checks, and timeline synthesis.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleRunCDS}
                      disabled={isLoadingCDS}
                      className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 shrink-0 shadow-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCDS ? 'animate-spin' : ''}`} />
                      <span>{isLoadingCDS ? 'Analyzing Clinical Profile...' : 'Run Differential CDS'}</span>
                    </button>
                  </div>

                  {/* Proposed Medications check input */}
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={proposedMedInput}
                      onChange={(e) => setProposedMedInput(e.target.value)}
                      placeholder="Cross-check proposed drugs against allergies (e.g. Penicillin, Aspirin, Warfarin)..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleRunCDS}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200"
                    >
                      Check Interactions
                    </button>
                  </div>

                  {/* CDS Output Display */}
                  {cdsResult && (
                    <div className="mt-5 space-y-4">
                      {/* Timeline Summary */}
                      <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 text-xs text-slate-800">
                        <span className="font-bold text-purple-900 block mb-1">
                          Physician Briefing & Timeline Synthesis:
                        </span>
                        <p className="leading-relaxed">{cdsResult.timelineSummary}</p>
                      </div>

                      {/* Drug Interaction Alerts */}
                      {cdsResult.drugInteractionAlerts && cdsResult.drugInteractionAlerts.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-2">
                          <h4 className="text-xs font-bold text-rose-800 flex items-center space-x-1.5 uppercase">
                            <ShieldAlert className="h-4 w-4 text-rose-600" />
                            <span>Pharmacological Interaction & Allergy Contraindications</span>
                          </h4>
                          {cdsResult.drugInteractionAlerts.map((alert, i) => (
                            <div key={i} className="text-xs text-rose-800 pl-4 border-l-2 border-rose-500">
                              <p className="font-bold">{alert.description}</p>
                              <p className="text-rose-700 mt-0.5 font-medium">{alert.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Differential Diagnoses Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                          <h4 className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                            Differential Diagnoses (Ranked by Likelihood)
                          </h4>
                          <div className="space-y-2">
                            {cdsResult.differentialDiagnoses.map((diff, i) => (
                              <div key={i} className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-slate-900">{diff.condition}</span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      diff.probability === 'High'
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : diff.probability === 'Moderate'
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {diff.probability} Likelihood
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px]">{diff.justification}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Critical Don't Miss & Suggested Workup */}
                        <div className="space-y-4">
                          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
                            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                              <AlertTriangle className="h-4 w-4 text-rose-600" />
                              <span>Critical &quot;Don&apos;t Miss&quot; Life Threats</span>
                            </h4>
                            <ul className="space-y-1 text-xs text-slate-700">
                              {cdsResult.criticalDontMiss.map((threat, i) => (
                                <li key={i} className="flex items-start space-x-1.5">
                                  <span className="text-rose-600 font-bold">•</span>
                                  <span>{threat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-200">
                            <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">
                              Recommended Diagnostic Workup
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {cdsResult.suggestedWorkup.map((test, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-white text-teal-800 border border-teal-200 text-[11px] font-semibold"
                                >
                                  {test}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section B: AI Medical Note & Discharge Generator */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">AI Medical Note & Discharge Generator</h3>
                      <p className="text-xs text-slate-500">
                        Type quick dictation notes. The AI engine converts them into formal SOAP notes, structured prescriptions, and patient instructions.
                      </p>
                    </div>
                  </div>

                  {signedSuccess && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Encounter officially signed and committed to the patient health record! Prescriptions and instructions are live in the Patient Portal.
                      </span>
                    </div>
                  )}

                  {/* Shorthand Dictation Input */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Physician Dictation / Clinical Shorthand
                      </label>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-bold self-center pr-1">1-Click Scribe:</span>
                        <button
                          type="button"
                          onClick={() => handleApplyScribeTemplate('acs')}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg font-bold border border-rose-200 transition-colors cursor-pointer"
                        >
                          🚨 ACS Chest Pain
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyScribeTemplate('sepsis')}
                          className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg font-bold border border-orange-200 transition-colors cursor-pointer"
                        >
                          🔥 Severe Sepsis
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyScribeTemplate('asthma')}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg font-bold border border-sky-200 transition-colors cursor-pointer"
                        >
                          💨 Asthma Flare
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyScribeTemplate('laceration')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold border border-emerald-200 transition-colors cursor-pointer"
                        >
                          🩹 Laceration Care
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={shorthandNotes}
                      onChange={(e) => setShorthandNotes(e.target.value)}
                      placeholder="Type quick clinical shorthand or impressions here..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingNotes}
                    onClick={handleGenerateMedicalNotes}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
                  >
                    {isGeneratingNotes ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Structuring Professional Medical Documentation...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Generate SOAP Note & Prescriptions</span>
                      </>
                    )}
                  </button>

                  {/* Formatted Editable SOAP Note Editor */}
                  {generatedNotes && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Subjective (HPI & Symptoms)
                          </label>
                          <textarea
                            rows={3}
                            value={soapSubjective}
                            onChange={(e) => setSoapSubjective(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Objective (Exam & Vitals)
                          </label>
                          <textarea
                            rows={3}
                            value={soapObjective}
                            onChange={(e) => setSoapObjective(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-sky-700 mb-1">
                            Assessment (Primary Diagnosis)
                          </label>
                          <textarea
                            rows={3}
                            value={soapAssessment}
                            onChange={(e) => setSoapAssessment(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:bg-white focus:border-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-emerald-700 mb-1">
                            Plan (Management & Orders)
                          </label>
                          <textarea
                            rows={3}
                            value={soapPlan}
                            onChange={(e) => setSoapPlan(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                          />
                        </div>
                      </div>

                      {/* Prescriptions Preview */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block">
                            Structured Prescriptions ({prescriptionsList.length})
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-slate-400 font-bold">1-Click Add Rx:</span>
                            <button
                              type="button"
                              onClick={() => handle1ClickPrescription('amox')}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 font-semibold cursor-pointer"
                            >
                              + Amox-Clav 875
                            </button>
                            <button
                              type="button"
                              onClick={() => handle1ClickPrescription('ibu')}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 font-semibold cursor-pointer"
                            >
                              + Ibuprofen 600
                            </button>
                            <button
                              type="button"
                              onClick={() => handle1ClickPrescription('lisinopril')}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 font-semibold cursor-pointer"
                            >
                              + Lisinopril 10
                            </button>
                            <button
                              type="button"
                              onClick={() => handle1ClickPrescription('albuterol')}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 font-semibold cursor-pointer"
                            >
                              + Albuterol HFA
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {prescriptionsList.map((rx, idx) => (
                            <div
                              key={`${rx.id || 'rx'}_${idx}`}
                              className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{rx.medication}</span>{' '}
                                <span className="text-teal-700 font-semibold">{rx.dosage}</span> · {rx.frequency} ({rx.route})
                                <div className="text-slate-500 text-[11px] mt-0.5">{rx.instructions}</div>
                              </div>
                              <span className="text-slate-600 font-semibold text-[11px]">{rx.duration}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Discharge Instructions */}
                      <div>
                        <label className="block text-xs font-bold text-purple-800 mb-1">
                          Patient-Friendly Plain-English Discharge Instructions
                        </label>
                        <textarea
                          rows={3}
                          value={dischargeInstructions}
                          onChange={(e) => setDischargeInstructions(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-purple-500"
                        />
                      </div>

                      {/* Sign and Finalize Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSignClinicalNote}
                          className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center space-x-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Digitally Sign & Commit Clinical Record</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== TAB 3: STAT DIAGNOSTIC ORDERS ===================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <TestTubes className="h-5 w-5 text-teal-600" />
                  <span>Hospital STAT Diagnostic & Lab Order Desk</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Order point-of-care laboratory tests and imaging, monitor statuses, and enter clinical result values.
                </p>
              </div>

              {selectedPatient && (
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Order for {selectedPatient.fullName}</span>
                </button>
              )}
            </div>

            {allLabOrders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                <TestTubes className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Diagnostic Orders</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Select a patient from the queue and click &quot;Order STAT Labs&quot; to request cardiac enzymes, CBC, metabolic panels, or radiographic imaging.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allLabOrders.map((order, idx) => (
                  <div
                    key={`${order.id}_${idx}`}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">{order.testName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {order.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            order.priority === 'STAT'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {order.priority}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            order.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {order.status === 'completed' ? 'Resulted' : 'In Progress'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500">
                        Patient: <strong className="text-slate-900">{order.patientName}</strong> ({order.patientMrn}) · Ordered by {order.doctorName}
                      </div>

                      {order.result && (
                        <div className="mt-2 text-xs font-mono p-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                          Result Value: <strong className="text-sky-700">{order.result}</strong>{' '}
                          {order.normalRange && <span className="text-slate-500">[{order.normalRange}]</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {order.status !== 'completed' ? (
                        <button
                          onClick={() => {
                            setOrderToResult(order);
                            setResultInput('');
                            setReferenceRangeInput('');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs"
                        >
                          Enter Test Result
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: SIGNED CLINICAL RECORDS ARCHIVE ===================== */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span>Signed Clinical Records & Legal EMR Archive</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Permanent electronic medical records, finalized SOAP documentation, differential diagnoses, and prescribed therapies.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Printer className="h-4 w-4 text-emerald-600" />
                  <span>Print EMR Summary</span>
                </button>
              </div>
            </div>

            {/* Search & Statistics Bar */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={notesSearchQuery}
                  onChange={(e) => setNotesSearchQuery(e.target.value)}
                  placeholder="Search by patient name, MRN, diagnosis, doctor, or medication..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-500 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {signedNotes.length} Signed Record{signedNotes.length !== 1 ? 's' : ''}
                </span>
                <span className="hidden md:inline text-slate-400">·</span>
                <span className="hidden md:inline">HIPAA & HL7 Certified EMR Store</span>
              </div>
            </div>

            {/* Filtered Notes List */}
            {(() => {
              const filtered = signedNotes.filter((n) => {
                if (!notesSearchQuery.trim()) return true;
                const q = notesSearchQuery.toLowerCase();
                return (
                  n.patientName.toLowerCase().includes(q) ||
                  n.patientMrn.toLowerCase().includes(q) ||
                  n.doctorName.toLowerCase().includes(q) ||
                  n.assessment.toLowerCase().includes(q) ||
                  n.plan.toLowerCase().includes(q) ||
                  (n.differentialDiagnoses && n.differentialDiagnoses.some((d) => d.toLowerCase().includes(q))) ||
                  (n.prescriptions && n.prescriptions.some((p) => p.medication.toLowerCase().includes(q)))
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {signedNotes.length === 0
                        ? 'No Signed Clinical Records Yet'
                        : 'No Records Match Your Search'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                      {signedNotes.length === 0
                        ? 'Select a patient from the Urgent Clinical Queue, complete the clinical documentation in the Chart tab, and click Digitally Sign & Commit.'
                        : 'Try searching with a different term, patient name, or medical record number.'}
                    </p>
                    {signedNotes.length === 0 && (
                      <button
                        onClick={() => setActiveTab('queue')}
                        className="py-2.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
                      >
                        <Activity className="h-4 w-4" />
                        <span>Go to Urgent Queue</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map((note, idx) => {
                    const isExpanded = expandedNoteId === note.id;
                    return (
                      <div
                        key={`${note.id}_${idx}`}
                        className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 transition-all hover:border-emerald-300"
                      >
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-slate-900">{note.patientName}</h3>
                              <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                {note.patientMrn}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Official Signed EMR</span>
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Attending: <strong className="text-slate-800">{note.doctorName}</strong> ({note.specialty}) · Signed:{' '}
                              {new Date(note.signedAt).toLocaleString([], {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => {
                                const targetPt = patients.find((p) => p.id === note.patientId);
                                if (targetPt) {
                                  setSelectedPatientId(targetPt.id);
                                }
                                setActiveTab('chart');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                              title="Open this patient in Clinical Chart"
                            >
                              <Stethoscope className="h-3.5 w-3.5" />
                              <span>Open Chart</span>
                            </button>

                            <button
                              onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {isExpanded ? 'Collapse' : 'Full Details'}
                            </button>
                          </div>
                        </div>

                        {/* SOAP Preview Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                              Subjective (Symptoms & History)
                            </span>
                            <p className="text-slate-800 line-clamp-3 leading-relaxed">{note.subjective}</p>
                          </div>

                          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                              Objective (Vitals & Physical Exam)
                            </span>
                            <p className="text-slate-800 line-clamp-3 leading-relaxed">{note.objective}</p>
                          </div>

                          <div className="bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200/80">
                            <span className="font-bold text-sky-800 uppercase text-[10px] block mb-1">
                              Assessment & Primary Diagnosis
                            </span>
                            <p className="text-slate-900 font-bold leading-relaxed">{note.assessment}</p>
                          </div>

                          <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80">
                            <span className="font-bold text-emerald-800 uppercase text-[10px] block mb-1">
                              Plan & Clinical Management
                            </span>
                            <p className="text-slate-800 leading-relaxed">{note.plan}</p>
                          </div>
                        </div>

                        {/* Differential Diagnoses Chips */}
                        {note.differentialDiagnoses && note.differentialDiagnoses.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">
                              Differential Considered:
                            </span>
                            {note.differentialDiagnoses.map((ddx, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-semibold"
                              >
                                {ddx}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Prescriptions */}
                        {note.prescriptions && note.prescriptions.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-teal-50/40 border border-teal-200 space-y-2">
                            <span className="text-xs font-bold text-teal-900 flex items-center space-x-1.5 uppercase text-[11px]">
                              <Pill className="h-3.5 w-3.5 text-teal-600" />
                              <span>Prescribed Therapies ({note.prescriptions.length})</span>
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {note.prescriptions.map((rx, idx) => (
                                <div
                                  key={`${rx.id || 'rx'}_${idx}`}
                                  className="p-2.5 bg-white rounded-xl border border-teal-100 text-xs shadow-2xs"
                                >
                                  <div className="font-bold text-slate-900">{rx.medication}</div>
                                  <div className="text-[11px] text-teal-700 font-semibold">
                                    {rx.dosage} · {rx.frequency} ({rx.route})
                                  </div>
                                  {rx.instructions && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">{rx.instructions}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Discharge Instructions */}
                        {note.dischargeInstructions && (
                          <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-200 text-xs text-purple-950">
                            <span className="font-bold text-purple-900 block mb-1 uppercase text-[10px]">
                              Discharge Instructions
                            </span>
                            <p className="leading-relaxed">{note.dischargeInstructions}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Order STAT Labs Modal */}
      {showOrderModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowOrderModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                <TestTubes className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Order Diagnostic Test</h3>
                <p className="text-xs text-slate-500">Patient: {selectedPatient.fullName}</p>
              </div>
            </div>

            <form onSubmit={handleCreateLabOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Test / Procedure
                </label>
                <select
                  value={newOrderTestName}
                  onChange={(e) => {
                    setNewOrderTestName(e.target.value);
                    if (e.target.value.includes('Troponin') || e.target.value.includes('ECG')) {
                      setNewOrderCategory('cardiac');
                    } else if (e.target.value.includes('CBC') || e.target.value.includes('Blood')) {
                      setNewOrderCategory('hematology');
                    } else if (e.target.value.includes('X-Ray') || e.target.value.includes('CT')) {
                      setNewOrderCategory('imaging');
                    } else {
                      setNewOrderCategory('chemistry');
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                >
                  <option value="High-Sensitivity Troponin I (0h, 2h)">High-Sensitivity Troponin I (0h, 2h)</option>
                  <option value="12-Lead Electrocardiogram (STAT)">12-Lead Electrocardiogram (STAT)</option>
                  <option value="Complete Blood Count (CBC) with Diff">Complete Blood Count (CBC) with Diff</option>
                  <option value="Basic Metabolic Panel (BMP)">Basic Metabolic Panel (BMP)</option>
                  <option value="Comprehensive Metabolic Panel (CMP)">Comprehensive Metabolic Panel (CMP)</option>
                  <option value="Serum Lactate & Blood Gas (ABG)">Serum Lactate & Blood Gas (ABG)</option>
                  <option value="Chest X-Ray (AP Portable)">Chest X-Ray (AP Portable)</option>
                  <option value="Computed Tomography (CT) Head Non-Contrast">CT Head Non-Contrast</option>
                  <option value="Computed Tomography (CT) Abdomen/Pelvis">CT Abdomen/Pelvis with IV Contrast</option>
                  <option value="Urinalysis with Microscopic Examination">Urinalysis with Microscopic Examination</option>
                  <option value="Blood Cultures (2 sets)">Blood Cultures (2 sets)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newOrderCategory}
                    onChange={(e) => setNewOrderCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                  >
                    <option value="cardiac">Cardiac</option>
                    <option value="hematology">Hematology</option>
                    <option value="chemistry">Chemistry</option>
                    <option value="imaging">Imaging</option>
                    <option value="urinalysis">Urinalysis</option>
                    <option value="microbiology">Microbiology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newOrderPriority}
                    onChange={(e) => setNewOrderPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                  >
                    <option value="STAT">STAT (Emergency)</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Routine">Routine</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="w-1/2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                >
                  Transmit Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enter Result Modal */}
      {orderToResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setOrderToResult(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Enter Test Result Value</h3>
            <p className="text-xs text-slate-500 mb-4">{orderToResult.testName} · {orderToResult.patientName}</p>

            <form onSubmit={handleResultLabOrder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observed Result</label>
                <input
                  type="text"
                  required
                  value={resultInput}
                  onChange={(e) => setResultInput(e.target.value)}
                  placeholder="e.g. 0.24 ng/mL (Elevated), or Normal sinus rhythm"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference Range / Units
                </label>
                <input
                  type="text"
                  value={referenceRangeInput}
                  onChange={(e) => setReferenceRangeInput(e.target.value)}
                  placeholder="e.g. < 0.04 ng/mL"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-sky-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToResult(null)}
                  className="w-1/2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                >
                  Save & Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
