import React, { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Table as TableIcon,
  LineChart as ChartIcon,
  Download,
  Info,
  ChevronRight,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { PatientVitalRecord, User } from '../../types';
import { storage } from '../../services/storage';

interface VitalsTrendsChartProps {
  user: User;
  onOpenLogModal?: () => void;
  className?: string;
}

type MetricType = 'bp' | 'hr' | 'sugar' | 'spo2' | 'temp' | 'resp' | 'all';
type TimeframeType = '7d' | '14d' | 'all';

interface MetricConfig {
  key: MetricType;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  secondaryColor?: string;
  fillGradient: string;
  secondaryFillGradient?: string;
  normalRange: [number, number];
  secondaryNormalRange?: [number, number];
  normalLabel: string;
  description: string;
}

const METRICS: Record<Exclude<MetricType, 'all'>, MetricConfig> = {
  bp: {
    key: 'bp',
    label: 'Blood Pressure',
    unit: 'mmHg',
    icon: Activity,
    color: '#e11d48', // rose-600
    secondaryColor: '#3b82f6', // blue-500
    fillGradient: 'from-rose-500/20 to-rose-500/0',
    secondaryFillGradient: 'from-blue-500/20 to-blue-500/0',
    normalRange: [90, 120], // Systolic
    secondaryNormalRange: [60, 80], // Diastolic
    normalLabel: 'Systolic: 90-120 mmHg · Diastolic: 60-80 mmHg',
    description: 'Systolic (cardiac contraction) and Diastolic (resting arterial pressure)',
  },
  hr: {
    key: 'hr',
    label: 'Heart Rate (Pulse)',
    unit: 'bpm',
    icon: Heart,
    color: '#059669', // emerald-600
    fillGradient: 'from-emerald-500/25 to-emerald-500/0',
    normalRange: [60, 100],
    normalLabel: '60 - 100 bpm (Normal Resting)',
    description: 'Resting pulse rate per minute in sinus rhythm',
  },
  sugar: {
    key: 'sugar',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    icon: Droplets,
    color: '#d97706', // amber-600
    fillGradient: 'from-amber-500/25 to-amber-500/0',
    normalRange: [70, 99],
    normalLabel: '70 - 99 mg/dL (Fasting Target)',
    description: 'Serum glucose concentration after meals or fasting',
  },
  spo2: {
    key: 'spo2',
    label: 'Oxygen Saturation (SpO2)',
    unit: '%',
    icon: Wind,
    color: '#0284c7', // sky-600
    fillGradient: 'from-sky-500/25 to-sky-500/0',
    normalRange: [95, 100],
    normalLabel: '95 - 100% (Adequate Perfusion)',
    description: 'Peripheral capillary oxygen saturation level',
  },
  temp: {
    key: 'temp',
    label: 'Body Temperature',
    unit: '°F',
    icon: Thermometer,
    color: '#ea580c', // orange-600
    fillGradient: 'from-orange-500/25 to-orange-500/0',
    normalRange: [97.8, 99.1],
    normalLabel: '97.8 - 99.1 °F (Afebrile Range)',
    description: 'Core basal body temperature reading',
  },
  resp: {
    key: 'resp',
    label: 'Respiratory Rate',
    unit: 'breaths/min',
    icon: Activity,
    color: '#7c3aed', // violet-600
    fillGradient: 'from-violet-500/25 to-violet-500/0',
    normalRange: [12, 20],
    normalLabel: '12 - 20 breaths/min (Eupnea)',
    description: 'Spontaneous ventilatory rate at rest',
  },
};

export const VitalsTrendsChart: React.FC<VitalsTrendsChartProps> = ({
  user,
  onOpenLogModal,
  className = '',
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bp');
  const [timeframe, setTimeframe] = useState<TimeframeType>('14d');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Quick In-Component Log State
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [newSystolic, setNewSystolic] = useState('120');
  const [newDiastolic, setNewDiastolic] = useState('80');
  const [newHeartRate, setNewHeartRate] = useState(72);
  const [newBloodSugar, setNewBloodSugar] = useState(95);
  const [newTemp, setNewTemp] = useState(98.6);
  const [newSpO2, setNewSpO2] = useState(98);
  const [newResp, setNewResp] = useState(16);
  const [newNotes, setNewNotes] = useState('Routine home vitals log');

  // Pull historical data from mock storage
  const rawHistory: PatientVitalRecord[] = useMemo(() => {
    // refreshKey dependency forces re-pull
    void refreshKey;
    return storage.getPatientVitalsHistory(user.id);
  }, [user.id, refreshKey]);

  // Filter by timeframe and sort chronologically (oldest to newest for line chart X-axis)
  const filteredData = useMemo(() => {
    const sorted = [...rawHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const now = new Date().getTime();
    if (timeframe === '7d') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      return sorted.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
    }
    if (timeframe === '14d') {
      const cutoff = now - 14 * 24 * 60 * 60 * 1000;
      return sorted.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
    }
    return sorted;
  }, [rawHistory, timeframe]);

  // Handle saving new vitals entry directly to mock storage
  const handleSaveQuickVitals = (e: React.FormEvent) => {
    e.preventDefault();
    const sys = parseInt(newSystolic, 10) || 120;
    const dia = parseInt(newDiastolic, 10) || 80;

    let status: 'optimal' | 'elevated' | 'high' | 'low' = 'optimal';
    if (sys >= 140 || dia >= 90) status = 'high';
    else if (sys >= 130 || dia >= 80) status = 'elevated';
    else if (sys < 90 || dia < 60) status = 'low';

    storage.savePatientVitalRecord(user.id, {
      systolicBP: sys,
      diastolicBP: dia,
      heartRate: Number(newHeartRate) || 72,
      bloodSugar: Number(newBloodSugar) || 95,
      temperature: Number(newTemp) || 98.6,
      o2Sat: Number(newSpO2) || 98,
      respRate: Number(newResp) || 16,
      source: 'patient_log',
      status,
      notes: newNotes,
    });

    setIsQuickLogOpen(false);
    setRefreshKey((k) => k + 1);
  };

  // Handle restoring mock baseline data
  const handleRestoreDefaults = () => {
    storage.resetPatientVitals(user.id);
    setRefreshKey((k) => k + 1);
  };

  // Helper calculations for summary analytics cards
  const latestRecord = filteredData[filteredData.length - 1];
  const previousRecord = filteredData.length > 1 ? filteredData[filteredData.length - 2] : null;

  const analytics = useMemo(() => {
    if (!filteredData.length) return null;

    const count = filteredData.length;
    const avgSys = Math.round(filteredData.reduce((acc, d) => acc + d.systolicBP, 0) / count);
    const avgDia = Math.round(filteredData.reduce((acc, d) => acc + d.diastolicBP, 0) / count);
    const avgHr = Math.round(filteredData.reduce((acc, d) => acc + d.heartRate, 0) / count);
    const avgSugar = Math.round(filteredData.reduce((acc, d) => acc + d.bloodSugar, 0) / count);
    const avgTemp = Number(
      (filteredData.reduce((acc, d) => acc + d.temperature, 0) / count).toFixed(1)
    );
    const avgSpo2 = Math.round(filteredData.reduce((acc, d) => acc + d.o2Sat, 0) / count);
    const avgResp = Math.round(filteredData.reduce((acc, d) => acc + d.respRate, 0) / count);

    const optimalCount = filteredData.filter((d) => d.status === 'optimal').length;
    const optimalPct = Math.round((optimalCount / count) * 100);

    return {
      avgSys,
      avgDia,
      avgHr,
      avgSugar,
      avgTemp,
      avgSpo2,
      avgResp,
      optimalPct,
      count,
    };
  }, [filteredData]);

  // SVG Chart Dimensions & Coordinate Calculators
  const chartWidth = 840;
  const chartHeight = 320;
  const paddingLeft = 58;
  const paddingRight = 32;
  const paddingTop = 36;
  const paddingBottom = 48;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Compute dynamic min/max scale for current metric
  const scaleBounds = useMemo(() => {
    if (!filteredData.length) return { min: 60, max: 140, step: 20 };

    if (selectedMetric === 'bp') {
      const allVals = filteredData.flatMap((d) => [d.systolicBP, d.diastolicBP]);
      const minVal = Math.min(...allVals, 60);
      const maxVal = Math.max(...allVals, 140);
      return {
        min: Math.floor((minVal - 10) / 10) * 10,
        max: Math.ceil((maxVal + 10) / 10) * 10,
        step: 20,
      };
    }

    if (selectedMetric === 'hr') {
      const vals = filteredData.map((d) => d.heartRate);
      const minVal = Math.min(...vals, 55);
      const maxVal = Math.max(...vals, 105);
      return {
        min: Math.floor((minVal - 10) / 10) * 10,
        max: Math.ceil((maxVal + 10) / 10) * 10,
        step: 15,
      };
    }

    if (selectedMetric === 'sugar') {
      const vals = filteredData.map((d) => d.bloodSugar);
      const minVal = Math.min(...vals, 70);
      const maxVal = Math.max(...vals, 120);
      return {
        min: Math.floor((minVal - 10) / 10) * 10,
        max: Math.ceil((maxVal + 10) / 10) * 10,
        step: 15,
      };
    }

    if (selectedMetric === 'spo2') {
      const vals = filteredData.map((d) => d.o2Sat);
      const minVal = Math.min(...vals, 92);
      return {
        min: Math.min(90, Math.floor(minVal - 2)),
        max: 100,
        step: 2,
      };
    }

    if (selectedMetric === 'temp') {
      const vals = filteredData.map((d) => d.temperature);
      const minVal = Math.min(...vals, 97.0);
      const maxVal = Math.max(...vals, 100.5);
      return {
        min: Math.floor(minVal * 2) / 2 - 0.5,
        max: Math.ceil(maxVal * 2) / 2 + 0.5,
        step: 0.5,
      };
    }

    if (selectedMetric === 'resp') {
      const vals = filteredData.map((d) => d.respRate);
      const minVal = Math.min(...vals, 10);
      const maxVal = Math.max(...vals, 24);
      return {
        min: Math.floor((minVal - 2) / 2) * 2,
        max: Math.ceil((maxVal + 2) / 2) * 2,
        step: 2,
      };
    }

    return { min: 50, max: 150, step: 20 };
  }, [filteredData, selectedMetric]);

  // Map value to Y pixel
  const getY = (val: number) => {
    const range = scaleBounds.max - scaleBounds.min || 1;
    const normalized = (val - scaleBounds.min) / range;
    return paddingTop + plotHeight - normalized * plotHeight;
  };

  // Map data index to X pixel
  const getX = (index: number) => {
    if (filteredData.length <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (filteredData.length - 1)) * plotWidth;
  };

  // Generate smooth cubic bezier SVG path from points
  const generateCurvedPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      const tension = 0.2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  // Generate closed area path for gradient fill under line
  const generateAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return '';
    const linePath = generateCurvedPath(points);
    const bottomY = paddingTop + plotHeight;
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  };

  // Primary and secondary line points
  const primaryPoints = useMemo(() => {
    return filteredData.map((d, i) => {
      let val = d.systolicBP;
      if (selectedMetric === 'hr') val = d.heartRate;
      if (selectedMetric === 'sugar') val = d.bloodSugar;
      if (selectedMetric === 'spo2') val = d.o2Sat;
      if (selectedMetric === 'temp') val = d.temperature;
      if (selectedMetric === 'resp') val = d.respRate;
      return { x: getX(i), y: getY(val), val, record: d };
    });
  }, [filteredData, selectedMetric, scaleBounds]);

  const secondaryPoints = useMemo(() => {
    if (selectedMetric !== 'bp') return [];
    return filteredData.map((d, i) => ({
      x: getX(i),
      y: getY(d.diastolicBP),
      val: d.diastolicBP,
      record: d,
    }));
  }, [filteredData, selectedMetric, scaleBounds]);

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const { min, max, step } = scaleBounds;
    for (let v = min; v <= max + 0.001; v += step) {
      ticks.push(Number(v.toFixed(1)));
    }
    return ticks;
  }, [scaleBounds]);

  // Current metric config
  const activeConfig = selectedMetric === 'all' ? METRICS.bp : METRICS[selectedMetric];

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Visual Health Trends & Vitals Chart
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Synced
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Continuous physiological trends from hospital clinical triage, home logs & wearable devices.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Pill */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeframe('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '7d'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('14d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '14d'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              14 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'chart'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Line Chart View"
            >
              <ChartIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Log Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenLogModal) onOpenLogModal();
              else setIsQuickLogOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Reading</span>
          </button>

          {/* Refresh / Restore Button */}
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
            title="Restore default mock baseline data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto py-4 scrollbar-none">
        {(Object.keys(METRICS) as Array<Exclude<MetricType, 'all'>>).map((key) => {
          const cfg = METRICS[key];
          const Icon = cfg.icon;
          const isSelected = selectedMetric === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedMetric(key)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 cursor-pointer border ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: isSelected ? '#38bdf8' : cfg.color }} />
              <span>{cfg.label}</span>
              {key === 'bp' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-800 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
                  Dual
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedMetric('all')}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 cursor-pointer border ${
            selectedMetric === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>All 6 Vitals Grid</span>
        </button>
      </div>

      {/* Analytics Summary Metric Cards */}
      {analytics && latestRecord && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Latest Reading
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-slate-900">
                {selectedMetric === 'bp'
                  ? `${latestRecord.systolicBP}/${latestRecord.diastolicBP}`
                  : selectedMetric === 'hr'
                  ? latestRecord.heartRate
                  : selectedMetric === 'sugar'
                  ? latestRecord.bloodSugar
                  : selectedMetric === 'spo2'
                  ? `${latestRecord.o2Sat}%`
                  : selectedMetric === 'temp'
                  ? `${latestRecord.temperature}°`
                  : latestRecord.respRate}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {selectedMetric === 'all' ? 'mmHg' : activeConfig.unit}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {latestRecord.dateLabel} · {latestRecord.timeLabel}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Period Average
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-slate-900">
                {selectedMetric === 'bp'
                  ? `${analytics.avgSys}/${analytics.avgDia}`
                  : selectedMetric === 'hr'
                  ? analytics.avgHr
                  : selectedMetric === 'sugar'
                  ? analytics.avgSugar
                  : selectedMetric === 'spo2'
                  ? `${analytics.avgSpo2}%`
                  : selectedMetric === 'temp'
                  ? `${analytics.avgTemp}°`
                  : analytics.avgResp}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {selectedMetric === 'all' ? 'mmHg' : activeConfig.unit}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
              Across {filteredData.length} records
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Clinical Compliance
            </span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl font-black text-emerald-600">{analytics.optimalPct}%</span>
              <span className="text-xs font-bold text-slate-500">In Range</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${analytics.optimalPct}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Clinical Target Zone
            </span>
            <span className="text-xs font-bold text-slate-800 block mt-1">
              {activeConfig.normalLabel}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
              {activeConfig.description}
            </span>
          </div>
        </div>
      )}

      {/* Main Interactive Chart Section */}
      {viewMode === 'chart' ? (
        selectedMetric === 'all' ? (
          /* Multi-Metric All 6 Vitals Overview Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
            {(Object.keys(METRICS) as Array<Exclude<MetricType, 'all'>>).map((mKey) => {
              const cfg = METRICS[mKey];
              const Icon = cfg.icon;
              const values = filteredData.map((d) => {
                if (mKey === 'bp') return d.systolicBP;
                if (mKey === 'hr') return d.heartRate;
                if (mKey === 'sugar') return d.bloodSugar;
                if (mKey === 'spo2') return d.o2Sat;
                if (mKey === 'temp') return d.temperature;
                return d.respRate;
              });

              const min = Math.min(...values);
              const max = Math.max(...values);
              const latest = values[values.length - 1];

              // Generate mini sparkline points
              const miniW = 280;
              const miniH = 70;
              const miniPoints = values.map((val, idx) => {
                const x = (idx / Math.max(values.length - 1, 1)) * (miniW - 16) + 8;
                const range = max - min || 1;
                const y = miniH - 12 - ((val - min) / range) * (miniH - 24);
                return { x, y };
              });
              const miniLine = generateCurvedPath(miniPoints);

              return (
                <div
                  key={mKey}
                  onClick={() => setSelectedMetric(mKey)}
                  className="bg-slate-50/70 hover:bg-slate-100/80 rounded-2xl p-4 border border-slate-200/90 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs"
                        style={{ color: cfg.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900">
                      {latest} {cfg.unit}
                    </span>
                  </div>

                  {/* Sparkline SVG */}
                  <div className="bg-white rounded-xl p-2 border border-slate-200/60 overflow-hidden">
                    <svg viewBox={`0 0 ${miniW} ${miniH}`} className="w-full h-16">
                      <path
                        d={miniLine}
                        fill="none"
                        stroke={cfg.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {miniPoints.map((pt, pIdx) => (
                        <circle
                          key={pIdx}
                          cx={pt.x}
                          cy={pt.y}
                          r={pIdx === miniPoints.length - 1 ? 4 : 2}
                          fill={pIdx === miniPoints.length - 1 ? cfg.color : '#ffffff'}
                          stroke={cfg.color}
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                    <span>Range: {min} - {max} {cfg.unit}</span>
                    <span className="text-sky-600 font-bold flex items-center">
                      View details <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single / Dual Line High-Resolution Chart */
          <div className="relative bg-slate-50/50 rounded-3xl p-3 sm:p-5 border border-slate-200/90 my-3 overflow-hidden">
            {/* Chart Legend & Target Range Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-2 text-xs">
              <div className="flex items-center space-x-4">
                {selectedMetric === 'bp' ? (
                  <>
                    <span className="flex items-center space-x-1.5 font-bold text-slate-800">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      <span>Systolic (mmHg)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 font-bold text-slate-800">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Diastolic (mmHg)</span>
                    </span>
                  </>
                ) : (
                  <span className="flex items-center space-x-1.5 font-bold text-slate-800">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeConfig.color }} />
                    <span>{activeConfig.label} ({activeConfig.unit})</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Normal Target Zone: <strong className="text-slate-700">{activeConfig.normalLabel}</strong></span>
              </div>
            </div>

            {/* SVG Visual Canvas */}
            <div className="relative w-full overflow-x-auto scrollbar-none">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full min-w-[680px] h-[300px] select-none"
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                <defs>
                  {/* Gradients */}
                  <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeConfig.color} stopOpacity="0.28" />
                    <stop offset="90%" stopColor={activeConfig.color} stopOpacity="0.0" />
                  </linearGradient>
                  {activeConfig.secondaryColor && (
                    <linearGradient id="secondaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeConfig.secondaryColor} stopOpacity="0.22" />
                      <stop offset="90%" stopColor={activeConfig.secondaryColor} stopOpacity="0.0" />
                    </linearGradient>
                  )}
                  {/* Subtle Filter for Glow */}
                  <filter id="pointGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                  </filter>
                </defs>

                {/* Shaded Clinical Target Range Band */}
                {selectedMetric !== 'bp' && (
                  <rect
                    x={paddingLeft}
                    y={getY(Math.min(activeConfig.normalRange[1], scaleBounds.max))}
                    width={plotWidth}
                    height={Math.max(
                      0,
                      getY(Math.max(activeConfig.normalRange[0], scaleBounds.min)) -
                        getY(Math.min(activeConfig.normalRange[1], scaleBounds.max))
                    )}
                    fill="#10b981"
                    fillOpacity="0.06"
                    stroke="#10b981"
                    strokeOpacity="0.18"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Y-Axis Grid Lines & Tick Labels */}
                {yTicks.map((tickVal) => {
                  const y = getY(tickVal);
                  return (
                    <g key={tickVal}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={chartWidth - paddingRight}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="10"
                        fill="#64748b"
                        fontWeight="600"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {/* Gradient Fill Beneath Curves */}
                {secondaryPoints.length > 0 && (
                  <path d={generateAreaPath(secondaryPoints)} fill="url(#secondaryAreaGrad)" />
                )}
                {primaryPoints.length > 0 && (
                  <path d={generateAreaPath(primaryPoints)} fill="url(#primaryAreaGrad)" />
                )}

                {/* Secondary Line (e.g. Diastolic BP) */}
                {secondaryPoints.length > 0 && (
                  <path
                    d={generateCurvedPath(secondaryPoints)}
                    fill="none"
                    stroke={activeConfig.secondaryColor || '#3b82f6'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Primary Metric Line */}
                {primaryPoints.length > 0 && (
                  <path
                    d={generateCurvedPath(primaryPoints)}
                    fill="none"
                    stroke={activeConfig.color}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* X-Axis Date Labels & Vertical Guideline on Hover */}
                {primaryPoints.map((pt, i) => {
                  const isHovered = hoveredPointIndex === i;
                  return (
                    <g key={i}>
                      {/* Vertical Hover Line */}
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={paddingTop}
                          x2={pt.x}
                          y2={paddingTop + plotHeight}
                          stroke="#0284c7"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* X-axis Tick Date */}
                      <text
                        x={pt.x}
                        y={paddingTop + plotHeight + 20}
                        textAnchor="middle"
                        fontSize="10"
                        fill={isHovered ? '#0f172a' : '#64748b'}
                        fontWeight={isHovered ? 'bold' : '500'}
                      >
                        {pt.record.dateLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Secondary Data Points (Diastolic) */}
                {secondaryPoints.map((pt, i) => {
                  const isHovered = hoveredPointIndex === i;
                  return (
                    <circle
                      key={`sec-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 4}
                      fill="#ffffff"
                      stroke={activeConfig.secondaryColor || '#3b82f6'}
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all cursor-pointer"
                    />
                  );
                })}

                {/* Primary Data Points */}
                {primaryPoints.map((pt, i) => {
                  const isHovered = hoveredPointIndex === i;
                  const isLatest = i === primaryPoints.length - 1;

                  return (
                    <g key={`pri-${i}`}>
                      {/* Pulse Ring for Latest Reading */}
                      {isLatest && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={10}
                          fill="none"
                          stroke={activeConfig.color}
                          strokeWidth="1.5"
                          opacity="0.4"
                          className="animate-ping"
                        />
                      )}

                      {/* Data Point Dot */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : isLatest ? 5.5 : 4.5}
                        fill={isHovered || isLatest ? activeConfig.color : '#ffffff'}
                        stroke={activeConfig.color}
                        strokeWidth={isHovered ? 3 : 2.5}
                        filter="url(#pointGlow)"
                        className="transition-all cursor-pointer"
                      />

                      {/* Invisible Transparent Hit Target for Mouse / Touch */}
                      <rect
                        x={pt.x - 22}
                        y={paddingTop}
                        width="44"
                        height={plotHeight + 25}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(i)}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Floating Interactive Tooltip */}
              {hoveredPointIndex !== null && filteredData[hoveredPointIndex] && (
                (() => {
                  const d = filteredData[hoveredPointIndex];
                  const pt = primaryPoints[hoveredPointIndex];
                  const leftPos = Math.min(
                    Math.max(pt.x - 110, 10),
                    chartWidth - 230
                  );

                  return (
                    <div
                      className="absolute top-4 pointer-events-none z-20 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[210px] transition-all"
                      style={{ left: `${leftPos}px` }}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-slate-200">
                          {d.dateLabel} · {d.timeLabel}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            d.status === 'optimal'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-amber-950 text-amber-300 border border-amber-700'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>

                      <div className="space-y-1 mt-2">
                        {selectedMetric === 'bp' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Blood Pressure:</span>
                            <span className="font-black text-white text-sm">
                              {d.systolicBP}/{d.diastolicBP} mmHg
                            </span>
                          </div>
                        ) : selectedMetric === 'hr' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Heart Rate:</span>
                            <span className="font-black text-white text-sm">{d.heartRate} bpm</span>
                          </div>
                        ) : selectedMetric === 'sugar' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Blood Sugar:</span>
                            <span className="font-black text-white text-sm">{d.bloodSugar} mg/dL</span>
                          </div>
                        ) : selectedMetric === 'spo2' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">SpO2 Oxygen:</span>
                            <span className="font-black text-white text-sm">{d.o2Sat}%</span>
                          </div>
                        ) : selectedMetric === 'temp' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Body Temp:</span>
                            <span className="font-black text-white text-sm">{d.temperature} °F</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Resp Rate:</span>
                            <span className="font-black text-white text-sm">{d.respRate} br/min</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>Source:</span>
                          <span className="capitalize font-semibold text-slate-200">
                            {d.source.replace('_', ' ')}
                          </span>
                        </div>

                        {d.notes && (
                          <p className="text-[10px] text-slate-300 italic pt-1 border-t border-slate-800">
                            &quot;{d.notes}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )
      ) : (
        /* Detailed Table Log View */
        <div className="overflow-x-auto my-3 rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Blood Pressure</th>
                <th className="py-3 px-3">Heart Rate</th>
                <th className="py-3 px-3">Blood Glucose</th>
                <th className="py-3 px-3">SpO2</th>
                <th className="py-3 px-3">Body Temp</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...filteredData].reverse().map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {rec.dateLabel} · <span className="text-slate-400 font-normal">{rec.timeLabel}</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {rec.systolicBP}/{rec.diastolicBP} <span className="text-slate-400 font-normal text-[10px]">mmHg</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {rec.heartRate} <span className="text-slate-400 font-normal text-[10px]">bpm</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {rec.bloodSugar} <span className="text-slate-400 font-normal text-[10px]">mg/dL</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {rec.o2Sat}%
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {rec.temperature}°F
                  </td>
                  <td className="py-3 px-3 capitalize text-slate-600">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                      {rec.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rec.status === 'optimal'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 max-w-xs truncate text-[11px]">
                    {rec.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline Quick Vitals Modal */}
      {isQuickLogOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Quick Log Vitals</h3>
                  <p className="text-xs text-slate-500">Record today&apos;s physiological readings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickLogOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickVitals} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Systolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={newSystolic}
                    onChange={(e) => setNewSystolic(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    placeholder="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Diastolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={newDiastolic}
                    onChange={(e) => setNewDiastolic(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    placeholder="80"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={newHeartRate}
                    onChange={(e) => setNewHeartRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    placeholder="72"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Blood Glucose (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={newBloodSugar}
                    onChange={(e) => setNewBloodSugar(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    placeholder="95"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    Temp (°F)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTemp}
                    onChange={(e) => setNewTemp(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    value={newSpO2}
                    onChange={(e) => setNewSpO2(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    Resp (br/m)
                  </label>
                  <input
                    type="number"
                    value={newResp}
                    onChange={(e) => setNewResp(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Clinical Notes / Context
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-sky-500"
                  placeholder="e.g., Morning resting check, post-walk"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickLogOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save & Update Chart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
