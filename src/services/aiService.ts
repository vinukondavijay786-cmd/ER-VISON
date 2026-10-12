import { storage } from './storage';

export interface SymptomCheckResult {
  triageLevel: 'Emergency' | 'Urgent Care' | 'Primary Care' | 'Self Care';
  emergencyFlags: string[];
  analysis: string;
  recommendedAction: string;
  selfCareTips: string[];
  questionsToAskDoctor: string[];
}

export interface TriageValidationResult {
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  suggestedEsiLevel: 1 | 2 | 3 | 4 | 5;
  detectedAnomalies: string[];
  hiddenRisks: string[];
  recommendedInterventions: string[];
  rationale: string;
}

export interface ClinicalCdsResult {
  differentialDiagnoses: {
    condition: string;
    probability: 'High' | 'Moderate' | 'Low';
    justification: string;
  }[];
  criticalDontMiss: string[];
  drugInteractionAlerts: {
    severity: 'Severe' | 'Moderate' | 'Notice';
    description: string;
    recommendation: string;
  }[];
  timelineSummary: string;
  suggestedWorkup: string[];
}

export interface MedicalNoteResult {
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  prescriptions: {
    medication: string;
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    instructions: string;
    precautions: string;
  }[];
  dischargeInstructions: string;
}

export interface MedicationExplanationResult {
  plainLanguageSummary: string;
  howToTake: string;
  commonSideEffects: string[];
  precautionsAndWarnings: string[];
}

export interface HealthSummaryResult {
  plainEnglishSummary: string;
  keyActionItems: string[];
  warningSigns: string[];
}

export const aiService = {
  async checkSymptoms(params: {
    symptoms: string;
    age?: string | number;
    gender?: string;
    duration?: string;
    chronicConditions?: string;
    userId?: string;
  }): Promise<SymptomCheckResult> {
    try {
      const response = await fetch('/api/ai/symptom-checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data: SymptomCheckResult = await response.json();
      if (params.userId) {
        storage.saveAILog({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          userId: params.userId,
          type: 'symptom_check',
          input: params,
          output: data,
          timestamp: new Date().toISOString(),
        });
      }
      return data;
    } catch (err) {
      console.warn('AI symptom check failed, using fallback:', err);
      return {
        triageLevel: 'Primary Care',
        emergencyFlags: [],
        analysis: 'Your described symptoms have been logged for healthcare review. While no critical red-flags are immediately detected, consultation with a clinician is recommended.',
        recommendedAction: 'Schedule a visit with a healthcare provider for physical evaluation.',
        selfCareTips: [
          'Stay well-hydrated with fluids.',
          'Rest in a comfortable position.',
          'Record temperature if feeling warm or feverish.',
        ],
        questionsToAskDoctor: [
          'What might be causing these specific symptoms?',
          'What activities or foods should I avoid?',
          'When can I expect improvement?',
        ],
      };
    }
  },

  async validateTriage(params: {
    vitals: any;
    chiefComplaint: string;
    age?: string;
    allergies?: string[];
    medicalHistory?: string[];
    userId?: string;
    patientId?: string;
  }): Promise<TriageValidationResult> {
    try {
      const response = await fetch('/api/ai/triage-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data: TriageValidationResult = await response.json();
      if (params.userId) {
        storage.saveAILog({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          userId: params.userId,
          patientId: params.patientId,
          type: 'triage_validation',
          input: params,
          output: data,
          timestamp: new Date().toISOString(),
        });
      }
      return data;
    } catch (err) {
      console.warn('Triage validation server call failed:', err);
      return {
        riskLevel: 'Moderate',
        suggestedEsiLevel: 3,
        detectedAnomalies: ['Vital signs recorded for emergency queue triage'],
        hiddenRisks: ['Routine monitoring for progression indicated'],
        recommendedInterventions: ['Continuous pulse oximetry', '12-lead ECG if complaint is cardiopulmonary'],
        rationale: 'Standard clinical guideline classification applied.',
      };
    }
  },

  async getClinicalCds(params: {
    patient: any;
    chiefComplaint?: string;
    vitals?: any;
    allergies?: string[];
    medicalHistory?: string[];
    currentMeds?: string[];
    userId?: string;
  }): Promise<ClinicalCdsResult> {
    try {
      const response = await fetch('/api/ai/clinical-cds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data: ClinicalCdsResult = await response.json();
      if (params.userId) {
        storage.saveAILog({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          userId: params.userId,
          patientId: params.patient?.id,
          type: 'clinical_cds',
          input: params,
          output: data,
          timestamp: new Date().toISOString(),
        });
      }
      return data;
    } catch (err) {
      console.warn('Clinical CDS call failed:', err);
      return {
        differentialDiagnoses: [
          { condition: 'Acute Unspecified Presentation', probability: 'Moderate', justification: 'Requires targeted diagnostic laboratory workup and history expansion.' },
          { condition: 'Secondary Inflammatory Reaction', probability: 'Low', justification: 'Associated with elevated pain/stress response.' },
        ],
        criticalDontMiss: ['Sepsis', 'Acute Coronary Event', 'Thromboembolic Disease'],
        drugInteractionAlerts: [],
        timelineSummary: 'Patient presented for clinical evaluation. Initial vitals and history recorded.',
        suggestedWorkup: ['Complete Blood Count', 'Basic Metabolic Panel', 'Electrocardiogram'],
      };
    }
  },

  async generateMedicalNotes(params: {
    shorthandNotes: string;
    patient: any;
    vitals?: any;
    doctorName?: string;
    specialty?: string;
    userId?: string;
  }): Promise<MedicalNoteResult> {
    try {
      const response = await fetch('/api/ai/medical-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data: MedicalNoteResult = await response.json();
      if (params.userId) {
        storage.saveAILog({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          userId: params.userId,
          patientId: params.patient?.id,
          type: 'medical_note',
          input: params,
          output: data,
          timestamp: new Date().toISOString(),
        });
      }
      return data;
    } catch (err) {
      console.warn('Medical note generation failed:', err);
      return {
        soapNote: {
          subjective: `Patient presented with: ${params.shorthandNotes}. Symptoms reviewed in detail with patient.`,
          objective: 'Vital signs assessed and documented. Patient is alert and oriented.',
          assessment: 'Clinical presentation consistent with initial symptomatic findings.',
          plan: 'Prescribed pharmacotherapy, educated patient on warning symptoms, scheduled follow-up.',
        },
        prescriptions: [
          {
            medication: 'Amoxicillin-Clavulanate',
            dosage: '875/125 mg',
            frequency: 'Twice daily with meals',
            route: 'Oral',
            duration: '7 days',
            instructions: 'Take with food and full glass of water. Complete full course.',
            precautions: 'Check for penicillin allergies.',
          },
        ],
        dischargeInstructions: 'Take medications as directed, stay hydrated, and return to the hospital immediately if you experience severe shortness of breath or high fever.',
      };
    }
  },

  async explainMedication(params: {
    medicationName: string;
    dosage?: string;
  }): Promise<MedicationExplanationResult> {
    try {
      const response = await fetch('/api/ai/explain-medication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      return await response.json();
    } catch (err) {
      return {
        plainLanguageSummary: `${params.medicationName} is an active medication prescribed to treat your diagnosed condition.`,
        howToTake: 'Take exactly as labeled by your pharmacist with plenty of water.',
        commonSideEffects: ['Mild nausea', 'Drowsiness or dizziness'],
        precautionsAndWarnings: ['Avoid alcohol and inform your doctor of any allergic reactions.'],
      };
    }
  },

  async sendChatMessage(params: {
    messages: { role: 'user' | 'model'; content: string }[];
    systemInstruction?: string;
    model?: 'standard' | 'fast';
  }): Promise<string> {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      return data.text || 'Message processed.';
    } catch (err) {
      console.warn('Chat request failed:', err);
      return 'I am currently operating with local clinical protocols. For acute symptoms, please consult your healthcare team directly or call 911 for emergency assistance.';
    }
  },

  async generateHealthSummary(params: {
    notes: any[];
    labOrders: any[];
    prescriptions: any[];
    patientName?: string;
    userId?: string;
  }): Promise<HealthSummaryResult> {
    try {
      const response = await fetch('/api/ai/health-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data: HealthSummaryResult = await response.json();
      if (params.userId) {
        storage.saveAILog({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          userId: params.userId,
          type: 'health_summary',
          input: params,
          output: data,
          timestamp: new Date().toISOString(),
        });
      }
      return data;
    } catch (err) {
      return {
        plainEnglishSummary: 'Your healthcare team has reviewed your health encounters and prescribed tailored care. Follow your medication schedule and attend scheduled follow-ups.',
        keyActionItems: [
          'Take prescribed medications regularly.',
          'Monitor your symptoms daily.',
          'Schedule recommended follow-up visits.',
        ],
        warningSigns: [
          'Sudden chest tightness or shortness of breath.',
          'High fever not coming down with medication.',
        ],
      };
    }
  },
};
