import React, { useState, useEffect } from 'react';
import { User, PatientRecord, Bed, VitalSigns, AcuityLevel } from '../../types';
import { storage, calculateMEWS, calculatePriorityScore } from '../../services/storage';
import { aiService, TriageValidationResult } from '../../services/aiService';
import {
  Activity,
  PlusCircle,
  AlertTriangle,
  Heart,
  Thermometer,
  Wind,
  BedDouble,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  Stethoscope,
  Filter,
  Search,
  Zap,
} from 'lucide-react';

interface NursePortalProps {
  user: User;
}

export const NursePortal: React.FC<NursePortalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'intake' | 'beds'>('queue');

  // Live Patient Queue & Beds
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [filterAcuity, setFilterAcuity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Patient for Triage Details / AI Validation modal
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [aiValidationResult, setAiValidationResult] = useState<TriageValidationResult | null>(null);
  const [isValidatingAI, setIsValidatingAI] = useState(false);

  // Bed Assignment Modal State
  const [patientToAssign, setPatientToAssign] = useState<PatientRecord | null>(null);

  // New Patient Intake Form State
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('1985-05-15');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [arrivalMode, setArrivalMode] = useState<'walk_in' | 'ambulance' | 'wheelchair' | 'transfer'>('walk_in');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergiesText, setAllergiesText] = useState('NKDA');
  const [medicalHistoryText, setMedicalHistoryText] = useState('Hypertension');
  const [triageNotes, setTriageNotes] = useState('');

  // Vital Signs
  const [heartRate, setHeartRate] = useState<number>(78);
  const [systolicBP, setSystolicBP] = useState<number>(124);
  const [diastolicBP, setDiastolicBP] = useState<number>(82);
  const [o2Sat, setO2Sat] = useState<number>(98);
  const [temperature, setTemperature] = useState<number>(98.6);
  const [respRate, setRespRate] = useState<number>(16);
  const [painScore, setPainScore] = useState<number>(4);
  const [consciousness, setConsciousness] = useState<'Alert' | 'Voice' | 'Pain' | 'Unresponsive'>('Alert');
  const [selectedAcuity, setSelectedAcuity] = useState<AcuityLevel>(3);

  // 1-Click Clinical Scenario Presets (Eliminates confusion and makes testing fast)
  const applyPreset = (presetType: 'chest_pain' | 'sepsis' | 'asthma' | 'stable') => {
    if (presetType === 'chest_pain') {
      setFullName('Robert Miller');
      setDob('1968-11-20');
      setGender('male');
      setArrivalMode('ambulance');
      setChiefComplaint('Crushing substernal chest pressure for 45 min, diaphoresis, radiating to jaw');
      setAllergiesText('Aspirin (Mild GI distress)');
      setMedicalHistoryText('CAD, Hyperlipidemia');
      setHeartRate(106);
      setSystolicBP(148);
      setDiastolicBP(92);
      setO2Sat(94);
      setTemperature(98.6);
      setRespRate(22);
      setPainScore(9);
      setConsciousness('Alert');
      setSelectedAcuity(2);
      setTriageNotes('Patient diaphoretic, clutching chest. 12-lead ECG indicated immediately.');
    } else if (presetType === 'sepsis') {
      setFullName('Evelyn Chen');
      setDob('1954-03-12');
      setGender('female');
      setArrivalMode('ambulance');
      setChiefComplaint('High fever, rigors, lethargy, productive cough, confusion onset 6 hours ago');
      setAllergiesText('Penicillin (Anaphylaxis)');
      setMedicalHistoryText('Type 2 Diabetes, COPD');
      setHeartRate(128);
      setSystolicBP(84);
      setDiastolicBP(50);
      setO2Sat(90);
      setTemperature(102.8);
      setRespRate(28);
      setPainScore(4);
      setConsciousness('Voice');
      setSelectedAcuity(1);
      setTriageNotes('Meets SIRS criteria with hypotension. Shock index 1.52. Sepsis resuscitation bundle required.');
    } else if (presetType === 'asthma') {
      setFullName('David Morales');
      setDob('2001-08-04');
      setGender('male');
      setArrivalMode('walk_in');
      setChiefComplaint('Acute wheezing and shortness of breath unresponsive to rescue albuterol inhaler');
      setAllergiesText('Peanuts, Sulfa');
      setMedicalHistoryText('Severe Asthma');
      setHeartRate(114);
      setSystolicBP(132);
      setDiastolicBP(86);
      setO2Sat(89);
      setTemperature(98.8);
      setRespRate(26);
      setPainScore(3);
      setConsciousness('Alert');
      setSelectedAcuity(2);
      setTriageNotes('Accessory muscle use observed. Titrating high-flow O2 and nebulizer therapy.');
    } else if (presetType === 'stable') {
      setFullName('Lucas Taylor');
      setDob('1996-06-19');
      setGender('male');
      setArrivalMode('walk_in');
      setChiefComplaint('Deep laceration on right forearm from workshop tool, active bleeding controlled with dressing');
      setAllergiesText('NKDA');
      setMedicalHistoryText('None');
      setHeartRate(74);
      setSystolicBP(122);
      setDiastolicBP(78);
      setO2Sat(99);
      setTemperature(98.4);
      setRespRate(16);
      setPainScore(5);
      setConsciousness('Alert');
      setSelectedAcuity(4);
      setTriageNotes('Distal pulses intact, sensation preserved. Requires wound irrigation and sutures.');
    }
  };

  // Quick live calculated metrics
  const currentMEWS = calculateMEWS({
    heartRate,
    systolicBP,
    diastolicBP,
    o2Sat,
    temperature,
    respRate,
    painScore,
    consciousness,
    recordedAt: '',
  });

  const shockIndex = systolicBP > 0 ? (heartRate / systolicBP).toFixed(2) : '0';

  const loadData = () => {
    const loadedPatients = storage.getPatients();
    // Sort patients using Priority Heap score (highest priority first)
    loadedPatients.sort((a, b) => b.priorityScore - a.priorityScore);
    setPatients(loadedPatients);
    setBeds(storage.getBeds());
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Submit Patient Intake
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !chiefComplaint.trim()) return;

    const recordedAt = new Date().toISOString();
    const vitals: VitalSigns = {
      heartRate: Number(heartRate),
      systolicBP: Number(systolicBP),
      diastolicBP: Number(diastolicBP),
      o2Sat: Number(o2Sat),
      temperature: Number(temperature),
      respRate: Number(respRate),
      painScore: Number(painScore),
      consciousness,
      recordedAt,
    };

    const mews = calculateMEWS(vitals);
    const priorityScore = calculatePriorityScore(selectedAcuity, recordedAt, mews);

    const mrn = `PC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newPatient: PatientRecord = {
      id: 'pt_' + Math.random().toString(36).substring(2, 9),
      mrn,
      fullName: fullName.trim(),
      dob,
      gender,
      arrivalMode,
      chiefComplaint: chiefComplaint.trim(),
      allergies: allergiesText
        ? allergiesText.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      medicalHistory: medicalHistoryText
        ? medicalHistoryText.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      currentVitals: vitals,
      vitalsHistory: [vitals],
      acuityLevel: selectedAcuity,
      mewsScore: mews,
      triageTime: recordedAt,
      status: 'waiting',
      triageNotes: triageNotes.trim(),
      priorityScore,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };

    if (aiValidationResult) {
      newPatient.aiTriageAssessment = {
        riskLevel: aiValidationResult.riskLevel,
        detectedAnomalies: aiValidationResult.detectedAnomalies,
        hiddenRisks: aiValidationResult.hiddenRisks,
        recommendedInterventions: aiValidationResult.recommendedInterventions,
        rationale: aiValidationResult.rationale,
      };
    }

    storage.savePatient(newPatient);

    // Reset Form
    setFullName('');
    setChiefComplaint('');
    setTriageNotes('');
    setAiValidationResult(null);
    loadData();
    setActiveTab('queue');
  };

  // Run AI Triage Validation on Intake or Selected Patient
  const handleValidateTriage = async (vitals: VitalSigns, complaint: string, patient?: PatientRecord) => {
    setIsValidatingAI(true);
    setAiValidationResult(null);

    const result = await aiService.validateTriage({
      vitals,
      chiefComplaint: complaint,
      age: patient?.dob || dob,
      allergies: patient ? patient.allergies : allergiesText.split(','),
      userId: user.id,
      patientId: patient?.id,
    });

    setAiValidationResult(result);
    setIsValidatingAI(false);

    if (result.suggestedEsiLevel) {
      setSelectedAcuity(result.suggestedEsiLevel);
    }

    if (patient) {
      patient.aiTriageAssessment = {
        riskLevel: result.riskLevel,
        detectedAnomalies: result.detectedAnomalies,
        hiddenRisks: result.hiddenRisks,
        recommendedInterventions: result.recommendedInterventions,
        rationale: result.rationale,
      };
      if (result.suggestedEsiLevel) {
        patient.acuityLevel = result.suggestedEsiLevel;
        patient.priorityScore = calculatePriorityScore(result.suggestedEsiLevel, patient.triageTime, patient.mewsScore);
      }
      storage.savePatient(patient);
      loadData();
    }
  };

  // Bed Assignment
  const handleAssignBed = (bedId: string) => {
    if (!patientToAssign) return;
    storage.assignBed(bedId, patientToAssign);
    setPatientToAssign(null);
    loadData();
  };

  // Change Bed Status
  const handleToggleBedStatus = (bedId: string, currentStatus: Bed['status']) => {
    const nextStatus = currentStatus === 'cleaning' ? 'available' : currentStatus === 'available' ? 'cleaning' : 'available';
    storage.setBedStatus(bedId, nextStatus);
    loadData();
  };

  // Discharge / Release Bed & Refresh Live State
  const handleReleaseBed = (bedId: string) => {
    storage.releaseBed(bedId);
    loadData();
  };

  // 1-Click Fast Intake Helper (Instant Queue Addition)
  const handle1ClickQuickIntake = (presetKey: 'chest_pain' | 'sepsis' | 'asthma' | 'stable' | 'pediatric_fever') => {
    let presetData: {
      fullName: string;
      dob: string;
      gender: 'male' | 'female' | 'other';
      arrivalMode: 'walk_in' | 'ambulance' | 'wheelchair' | 'transfer';
      chiefComplaint: string;
      allergies: string[];
      medicalHistory: string[];
      triageNotes: string;
      vitals: VitalSigns;
      acuity: AcuityLevel;
    };

    const recordedAt = new Date().toISOString();

    if (presetKey === 'chest_pain') {
      presetData = {
        fullName: 'Robert Miller',
        dob: '1968-11-20',
        gender: 'male',
        arrivalMode: 'ambulance',
        chiefComplaint: 'Crushing substernal chest pressure for 45 min, diaphoresis, radiating to left jaw',
        allergies: ['Aspirin (Mild GI)'],
        medicalHistory: ['CAD', 'Hyperlipidemia'],
        triageNotes: 'Patient diaphoretic, clutching chest. 12-lead ECG indicated immediately.',
        vitals: {
          heartRate: 106,
          systolicBP: 148,
          diastolicBP: 92,
          o2Sat: 94,
          temperature: 98.6,
          respRate: 22,
          painScore: 9,
          consciousness: 'Alert',
          recordedAt,
        },
        acuity: 2,
      };
    } else if (presetKey === 'sepsis') {
      presetData = {
        fullName: 'Evelyn Chen',
        dob: '1954-03-12',
        gender: 'female',
        arrivalMode: 'ambulance',
        chiefComplaint: 'High fever, rigors, lethargy, productive cough, confusion onset 6 hours ago',
        allergies: ['Penicillin (Anaphylaxis)'],
        medicalHistory: ['Type 2 Diabetes', 'COPD'],
        triageNotes: 'Meets SIRS criteria with hypotension. Shock index 1.52. Sepsis resuscitation bundle required.',
        vitals: {
          heartRate: 128,
          systolicBP: 84,
          diastolicBP: 50,
          o2Sat: 90,
          temperature: 102.8,
          respRate: 28,
          painScore: 4,
          consciousness: 'Voice',
          recordedAt,
        },
        acuity: 1,
      };
    } else if (presetKey === 'asthma') {
      presetData = {
        fullName: 'David Morales',
        dob: '2001-08-04',
        gender: 'male',
        arrivalMode: 'walk_in',
        chiefComplaint: 'Acute wheezing and shortness of breath unresponsive to rescue albuterol inhaler',
        allergies: ['Peanuts', 'Sulfa'],
        medicalHistory: ['Severe Asthma'],
        triageNotes: 'Accessory muscle use observed. Titrating high-flow O2 and nebulizer therapy.',
        vitals: {
          heartRate: 114,
          systolicBP: 132,
          diastolicBP: 86,
          o2Sat: 89,
          temperature: 98.8,
          respRate: 26,
          painScore: 3,
          consciousness: 'Alert',
          recordedAt,
        },
        acuity: 2,
      };
    } else if (presetKey === 'pediatric_fever') {
      presetData = {
        fullName: 'Liam Johnson',
        dob: '2022-04-10',
        gender: 'male',
        arrivalMode: 'walk_in',
        chiefComplaint: 'High fever 104°F, irritable, brief febrile twitching witnessed by parents',
        allergies: ['NKDA'],
        medicalHistory: ['None'],
        triageNotes: 'Pediatric patient febrile, flushed. Needs antipyretics and active cooling stat.',
        vitals: {
          heartRate: 142,
          systolicBP: 100,
          diastolicBP: 64,
          o2Sat: 97,
          temperature: 104.0,
          respRate: 34,
          painScore: 6,
          consciousness: 'Alert',
          recordedAt,
        },
        acuity: 2,
      };
    } else {
      presetData = {
        fullName: 'Lucas Taylor',
        dob: '1996-06-19',
        gender: 'male',
        arrivalMode: 'walk_in',
        chiefComplaint: 'Deep laceration on right forearm from workshop tool, active bleeding controlled',
        allergies: ['NKDA'],
        medicalHistory: ['None'],
        triageNotes: 'Distal pulses intact, sensation preserved. Requires wound irrigation and sutures.',
        vitals: {
          heartRate: 74,
          systolicBP: 122,
          diastolicBP: 78,
          o2Sat: 99,
          temperature: 98.4,
          respRate: 16,
          painScore: 5,
          consciousness: 'Alert',
          recordedAt,
        },
        acuity: 4,
      };
    }

    const mews = calculateMEWS(presetData.vitals);
    const priorityScore = calculatePriorityScore(presetData.acuity, recordedAt, mews);
    const mrn = `PC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newPatient: PatientRecord = {
      id: 'pt_' + Math.random().toString(36).substring(2, 9),
      mrn,
      fullName: presetData.fullName,
      dob: presetData.dob,
      gender: presetData.gender,
      arrivalMode: presetData.arrivalMode,
      chiefComplaint: presetData.chiefComplaint,
      allergies: presetData.allergies,
      medicalHistory: presetData.medicalHistory,
      triageNotes: presetData.triageNotes,
      triageTime: recordedAt,
      acuityLevel: presetData.acuity,
      currentVitals: presetData.vitals,
      vitalsHistory: [presetData.vitals],
      mewsScore: mews,
      priorityScore,
      status: 'waiting',
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };

    storage.savePatient(newPatient);
    loadData();
  };

  // 1-Click Auto-Assign Next Open Bed
  const handleAutoAssignNextOpenBed = (patient: PatientRecord) => {
    const freeBed = beds.find((b) => b.status === 'available');
    if (!freeBed) {
      alert('All treatment bays are currently occupied or being cleaned. Please discharge a bay in the Bed Matrix.');
      return;
    }
    storage.assignBed(freeBed.id, patient);
    loadData();
  };

  // 1-Click Quick Patient Status Progression
  const handleCycleStatus = (patient: PatientRecord) => {
    const nextStatusMap: Record<PatientRecord['status'], PatientRecord['status']> = {
      waiting: 'in_triage',
      in_triage: 'assigned_bed',
      assigned_bed: 'with_doctor',
      with_doctor: 'admitted',
      admitted: 'discharged',
      discharged: 'waiting',
    };
    patient.status = nextStatusMap[patient.status] || 'waiting';
    patient.updatedAt = new Date().toISOString();
    storage.savePatient(patient);
    loadData();
  };

  // Helper for Acuity Badges
  const renderAcuityBadge = (level: AcuityLevel) => {
    const config = {
      1: { label: 'ESI 1: Resuscitation', bg: 'bg-rose-50 text-rose-800 border-rose-300' },
      2: { label: 'ESI 2: Emergent', bg: 'bg-orange-50 text-orange-800 border-orange-300' },
      3: { label: 'ESI 3: Urgent', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
      4: { label: 'ESI 4: Less Urgent', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
      5: { label: 'ESI 5: Non-Urgent', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
    }[level];

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase ${config.bg}`}>
        {config.label}
      </span>
    );
  };

  const filteredPatients = patients.filter((p) => {
    const matchesAcuity = filterAcuity === 'all' || p.acuityLevel.toString() === filterAcuity;
    const matchesSearch =
      searchQuery === '' ||
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAcuity && matchesSearch;
  });

  const availableBeds = beds.filter((b) => b.status === 'available');
  const occupiedBeds = beds.filter((b) => b.status === 'occupied');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 pb-16">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex space-x-1 sm:space-x-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'queue'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Activity className="h-4 w-4 text-amber-600" />
                <span>Priority Triage Queue ({patients.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('intake')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'intake'
                    ? 'bg-sky-50 text-sky-800 border border-sky-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="h-4 w-4 text-sky-600" />
                <span>Fast Patient Intake</span>
              </button>

              <button
                onClick={() => setActiveTab('beds')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
                  activeTab === 'beds'
                    ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BedDouble className="h-4 w-4 text-teal-600" />
                <span>Bed Matrix ({availableBeds.length}/{beds.length} Free)</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-slate-500">ER Load:</span>
                <span className="font-bold text-amber-700">{occupiedBeds.length} Bays Occupied</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ===================== TAB 1: PRIORITY HEAP QUEUE ===================== */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-amber-600" />
                  <span>Clinical Acuity Priority Heap Queue</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Dynamic priority heap algorithm ranking patients by Emergency Severity Index (ESI), Modified Early Warning Score (MEWS), and elapsed wait time.
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patient or MRN..."
                    className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
                  />
                </div>

                {/* Acuity Filter */}
                <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs shadow-xs">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={filterAcuity}
                    onChange={(e) => setFilterAcuity(e.target.value)}
                    className="bg-transparent text-slate-700 focus:outline-none text-xs font-medium"
                  >
                    <option value="all">All ESI Levels</option>
                    <option value="1">ESI 1 (Resuscitation)</option>
                    <option value="2">ESI 2 (Emergent)</option>
                    <option value="3">ESI 3 (Urgent)</option>
                    <option value="4">ESI 4 (Less Urgent)</option>
                    <option value="5">ESI 5 (Non-Urgent)</option>
                  </select>
                </div>

                <button
                  onClick={() => setActiveTab('intake')}
                  className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs shrink-0 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Manual Form</span>
                </button>
              </div>
            </div>

            {/* ================= CLICK & DO MY WORK: FAST INTAKE COMMAND CENTER ================= */}
            <div className="bg-gradient-to-r from-amber-50/70 via-white to-sky-50/60 border border-amber-200/90 rounded-3xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-amber-100 gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      1-Click Fast Intake Command Center
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Click any scenario below to immediately register & triage an arrival with verified vitals into the queue.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider self-start sm:self-auto">
                  Instant Intake (1-Click)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => handle1ClickQuickIntake('chest_pain')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-left transition-all shadow-xs cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-rose-700">
                    🚨 Cardiac ACS (Ambulance)
                  </div>
                  <div className="text-[10px] text-rose-600 font-semibold mt-0.5">ESI 2 · HR 106 · Pain 9</div>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickQuickIntake('sepsis')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-left transition-all shadow-xs cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-orange-700">
                    🔥 Sepsis Shock (Ambulance)
                  </div>
                  <div className="text-[10px] text-orange-600 font-semibold mt-0.5">ESI 1 · BP 84/50 · HR 128</div>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickQuickIntake('asthma')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left transition-all shadow-xs cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-sky-700">
                    💨 Acute Asthma (Walk-in)
                  </div>
                  <div className="text-[10px] text-sky-600 font-semibold mt-0.5">ESI 2 · SpO2 89% · RR 26</div>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickQuickIntake('pediatric_fever')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-left transition-all shadow-xs cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-purple-700">
                    👶 Pediatric Fever (Walk-in)
                  </div>
                  <div className="text-[10px] text-purple-600 font-semibold mt-0.5">ESI 2 · Temp 104°F · HR 142</div>
                </button>

                <button
                  type="button"
                  onClick={() => handle1ClickQuickIntake('stable')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left transition-all shadow-xs cursor-pointer group col-span-2 sm:col-span-1"
                >
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-emerald-700">
                    🩹 Arm Laceration (Walk-in)
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">ESI 4 · Stable Vitals</div>
                </button>
              </div>
            </div>

            {/* Queue List Table */}
            {filteredPatients.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xs">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">Queue is Currently Clear</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  No emergency patients are currently awaiting clinical assessment. Use the Fast Intake tab to register walk-ins or ambulance arrivals.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => {
                      applyPreset('chest_pain');
                      setActiveTab('intake');
                    }}
                    className="py-2 px-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold text-xs transition-colors"
                  >
                    Quick-Intake Chest Pain Patient
                  </button>
                  <button
                    onClick={() => {
                      applyPreset('sepsis');
                      setActiveTab('intake');
                    }}
                    className="py-2 px-3.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-bold text-xs transition-colors"
                  >
                    Quick-Intake Sepsis Alert
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((patient, index) => {
                  const waitMinutes = Math.max(
                    0,
                    Math.round((Date.now() - new Date(patient.triageTime).getTime()) / (1000 * 60))
                  );
                  const isHighAcuity = patient.acuityLevel <= 2;

                  return (
                    <div
                      key={patient.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
                        isHighAcuity
                          ? 'border-rose-300 bg-rose-50/30'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Patient Identity & Acuity */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              #{index + 1} Heap Rank
                            </span>
                            <span className="font-mono text-xs font-semibold text-sky-700">{patient.mrn}</span>
                            {renderAcuityBadge(patient.acuityLevel)}
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              MEWS: {patient.mewsScore}
                            </span>
                            {patient.assignedBedName && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                Bed: {patient.assignedBedName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-bold text-slate-900">{patient.fullName}</h3>
                            <span className="text-xs text-slate-500">
                              ({patient.gender}, {patient.dob})
                            </span>
                            <span className="text-xs text-slate-500">· Arrival: {patient.arrivalMode}</span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium">
                            <span className="text-slate-500">Chief Complaint:</span> {patient.chiefComplaint}
                          </p>
                        </div>

                        {/* Vitals Snapshot */}
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block">HR</span>
                            <span
                              className={`text-xs font-bold ${
                                patient.currentVitals.heartRate > 100 || patient.currentVitals.heartRate < 55
                                  ? 'text-rose-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {patient.currentVitals.heartRate} bpm
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">BP</span>
                            <span
                              className={`text-xs font-bold ${
                                patient.currentVitals.systolicBP < 95 || patient.currentVitals.systolicBP >= 160
                                  ? 'text-rose-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {patient.currentVitals.systolicBP}/{patient.currentVitals.diastolicBP}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">SpO2</span>
                            <span
                              className={`text-xs font-bold ${
                                patient.currentVitals.o2Sat < 93 ? 'text-rose-600' : 'text-slate-800'
                              }`}
                            >
                              {patient.currentVitals.o2Sat}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Temp</span>
                            <span className="text-xs font-bold text-slate-800">
                              {patient.currentVitals.temperature}°F
                            </span>
                          </div>
                          <div className="hidden sm:block">
                            <span className="text-[10px] text-slate-500 block">Pain</span>
                            <span className="text-xs font-bold text-amber-700">
                              {patient.currentVitals.painScore}/10
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <div className="text-right mr-1 hidden sm:block">
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>Waited: {waitMinutes}m</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Priority: {patient.priorityScore}
                            </div>
                          </div>

                          {/* 1-Click Status Stepper */}
                          <button
                            type="button"
                            onClick={() => handleCycleStatus(patient)}
                            title="Click to advance status"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <span className="capitalize">{patient.status.replace(/_/g, ' ')}</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              handleValidateTriage(patient.currentVitals, patient.chiefComplaint, patient);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>AI Audit</span>
                          </button>

                          {!patient.assignedBedId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAutoAssignNextOpenBed(patient)}
                                className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center space-x-1 transition-colors shadow-xs cursor-pointer"
                                title="Assign to first available bay with 1 click"
                              >
                                <Zap className="h-3.5 w-3.5" />
                                <span>Auto-Bed (1-Click)</span>
                              </button>
                              <button
                                onClick={() => setPatientToAssign(patient)}
                                className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                              >
                                Pick
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => storage.releaseBed(patient.assignedBedId!)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                            >
                              Release Bed
                            </button>
                          )}
                        </div>
                      </div>

                      {/* AI Deterioration Warning if present */}
                      {patient.aiTriageAssessment && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-purple-700 font-bold flex items-center space-x-1">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>AI Deterioration Alert:</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              patient.aiTriageAssessment.riskLevel === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : patient.aiTriageAssessment.riskLevel === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {patient.aiTriageAssessment.riskLevel} Risk
                          </span>
                          <span className="text-slate-600">
                            {patient.aiTriageAssessment.hiddenRisks.slice(0, 2).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: FAST PATIENT INTAKE ENGINE ===================== */}
        {activeTab === 'intake' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Emergency Intake & Triage Engine</h2>
                    <p className="text-xs text-slate-500">
                      Record walk-in demographics, calculate MEWS acuity, run AI triage verification, and prioritize the ER queue.
                    </p>
                  </div>
                </div>

                {/* 1-Click Clinical Scenario Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Scenarios:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('chest_pain')}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold"
                  >
                    Chest Pain (ESI 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('sepsis')}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-bold"
                  >
                    Sepsis (ESI 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('asthma')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold"
                  >
                    Asthma (ESI 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('stable')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold"
                  >
                    Laceration (ESI 4)
                  </button>
                </div>
              </div>

              <form onSubmit={handleIntakeSubmit} className="space-y-6 mt-6">
                {/* Demographics & Arrival */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Johnathan Doe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Arrival Mode</label>
                    <select
                      value={arrivalMode}
                      onChange={(e) => setArrivalMode(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500"
                    >
                      <option value="walk_in">Walk-In</option>
                      <option value="ambulance">EMS / Ambulance (Priority)</option>
                      <option value="wheelchair">Wheelchair Assist</option>
                      <option value="transfer">Hospital Transfer</option>
                    </select>
                  </div>
                </div>

                {/* Chief Complaint */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chief Complaint & History of Present Emergency
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="e.g. Sudden severe retrosternal chest pain radiating to back, diaphoresis..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-500"
                  />
                </div>

                {/* Vitals Input Grid */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                      <Heart className="h-4 w-4 text-rose-500" />
                      <span>Physiological Vital Signs & MEWS Calculator</span>
                    </h3>
                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-slate-500">Shock Index (HR/SBP):</span>
                      <span
                        className={`font-mono font-bold ${
                          Number(shockIndex) >= 0.9 ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {shockIndex} {Number(shockIndex) >= 0.9 ? '(High Alert)' : ''}
                      </span>
                      <span className="text-slate-500">MEWS Score:</span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${
                          currentMEWS >= 4
                            ? 'bg-rose-100 text-rose-800'
                            : currentMEWS >= 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {currentMEWS}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={heartRate}
                        onChange={(e) => setHeartRate(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Systolic BP</label>
                      <input
                        type="number"
                        value={systolicBP}
                        onChange={(e) => setSystolicBP(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Diastolic BP</label>
                      <input
                        type="number"
                        value={diastolicBP}
                        onChange={(e) => setDiastolicBP(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">SpO2 (%)</label>
                      <input
                        type="number"
                        value={o2Sat}
                        onChange={(e) => setO2Sat(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Temp (°F)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Resp Rate (RR)</label>
                      <input
                        type="number"
                        value={respRate}
                        onChange={(e) => setRespRate(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pain (0-10)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={painScore}
                        onChange={(e) => setPainScore(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Alertness</label>
                      <select
                        value={consciousness}
                        onChange={(e) => setConsciousness(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500"
                      >
                        <option value="Alert">Alert</option>
                        <option value="Voice">Voice</option>
                        <option value="Pain">Pain</option>
                        <option value="Unresponsive">Unresponsive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Acuity Level Selection & AI Validation Action */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Emergency Severity Index (ESI Level)
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSelectedAcuity(lvl as AcuityLevel)}
                          className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all ${
                            selectedAcuity === lvl
                              ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          ESI {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Clinical AI Triage Assistant
                    </label>
                    <button
                      type="button"
                      disabled={isValidatingAI}
                      onClick={() =>
                        handleValidateTriage(
                          {
                            heartRate,
                            systolicBP,
                            diastolicBP,
                            o2Sat,
                            temperature,
                            respRate,
                            painScore,
                            consciousness,
                            recordedAt: new Date().toISOString(),
                          },
                          chiefComplaint || 'Acute emergency intake'
                        )
                      }
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{isValidatingAI ? 'Cross-Checking Guidelines...' : 'Run AI Triage Validation'}</span>
                    </button>
                  </div>
                </div>

                {/* AI Triage Result Box if run */}
                {aiValidationResult && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 flex items-center space-x-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <span>AI Triage Recommendation: Level {aiValidationResult.suggestedEsiLevel}</span>
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded bg-purple-200/80 text-purple-900 uppercase">
                        {aiValidationResult.riskLevel} Risk
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{aiValidationResult.rationale}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-purple-200">
                      <div>
                        <span className="font-bold text-amber-800 block mb-1">Deterioration Markers:</span>
                        <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                          {aiValidationResult.hiddenRisks.map((risk, i) => (
                            <li key={i}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-bold text-teal-800 block mb-1">Immediate Interventions:</span>
                        <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                          {aiValidationResult.recommendedInterventions.map((int, i) => (
                            <li key={i}>{int}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shadow-xs"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Admit Patient to Priority Triage Queue</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: BED MATRIX ===================== */}
        {activeTab === 'beds' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <BedDouble className="h-5 w-5 text-teal-600" />
                  <span>Hospital ER Bay & Resource Matrix</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time bed occupancy, cleaning sanitization status, and one-click patient bay allocation.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Legend:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Available
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  Occupied
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Cleaning
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {beds.map((bed) => {
                const isOccupied = bed.status === 'occupied';
                const isCleaning = bed.status === 'cleaning';

                return (
                  <div
                    key={bed.id}
                    className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 ${
                      isOccupied
                        ? 'border-rose-300 bg-rose-50/20'
                        : isCleaning
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {bed.number}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                            bed.status === 'available'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isOccupied
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {bed.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{bed.name}</h4>
                      <span className="text-[11px] text-slate-500 capitalize">{bed.type.replace('_', ' ')} Bay</span>

                      {isOccupied && bed.patientName && (
                        <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-200 text-xs space-y-1 shadow-xs">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Occupant</span>
                          <span className="font-bold text-slate-900 block">{bed.patientName}</span>
                          {bed.patientAcuity && renderAcuityBadge(bed.patientAcuity)}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      {isOccupied ? (
                        <button
                          onClick={() => handleReleaseBed(bed.id)}
                          className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
                        >
                          Discharge / Release Bay
                        </button>
                      ) : isCleaning ? (
                        <button
                          onClick={() => handleToggleBedStatus(bed.id, bed.status)}
                          className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
                        >
                          Mark Sanitized & Ready
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleBedStatus(bed.id, bed.status)}
                          className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          Set to Cleaning
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bed Assignment Modal */}
      {patientToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setPatientToAssign(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
                <BedDouble className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Assign Treatment Bay</h3>
                <p className="text-xs text-slate-500">Patient: {patientToAssign.fullName}</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {availableBeds.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No beds are currently available. Discharge or sanitize a bed first.
                </div>
              ) : (
                availableBeds.map((bed) => (
                  <button
                    key={bed.id}
                    onClick={() => handleAssignBed(bed.id)}
                    className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-sky-50 border border-slate-200 text-left flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{bed.name}</div>
                      <div className="text-[11px] text-slate-500">{bed.number} · {bed.type}</div>
                    </div>
                    <span className="text-xs font-bold text-sky-700">Select →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Triage Validation Modal Details */}
      {selectedPatient && aiValidationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => {
                setSelectedPatient(null);
                setAiValidationResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Triage Clinical Validation</h3>
                <p className="text-xs text-slate-500">Patient: {selectedPatient.fullName} ({selectedPatient.mrn})</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200">
                <span className="font-bold text-purple-900 block mb-1">Clinical Acuity Assessment</span>
                <p className="text-slate-700 leading-relaxed">{aiValidationResult.rationale}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-200">
                  <span className="font-bold text-rose-800 block mb-1">Deterioration Alerts</span>
                  <ul className="space-y-1 text-slate-700">
                    {aiValidationResult.hiddenRisks.map((risk, i) => (
                      <li key={i} className="flex items-start space-x-1">
                        <span className="text-rose-600 font-bold">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-teal-50/50 p-3 rounded-2xl border border-teal-200">
                  <span className="font-bold text-teal-800 block mb-1">Nursing Interventions</span>
                  <ul className="space-y-1 text-slate-700">
                    {aiValidationResult.recommendedInterventions.map((int, i) => (
                      <li key={i} className="flex items-start space-x-1">
                        <span className="text-teal-600 font-bold">•</span>
                        <span>{int}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedPatient(null);
                    setAiValidationResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                >
                  Accept & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
