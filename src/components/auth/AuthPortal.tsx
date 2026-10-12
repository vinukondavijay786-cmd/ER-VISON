import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { storage, hashPassword } from '../../services/storage';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import {
  HeartPulse,
  User as UserIcon,
  Stethoscope,
  Activity,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Phone,
  Sparkles,
  BedDouble,
  CheckCircle2,
  Clock,
  Zap,
  FileText,
  TestTubes,
  ChevronDown,
  HelpCircle,
  Award,
  Layers,
} from 'lucide-react';

interface AuthPortalProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Role-specific fields
  const [specialty, setSpecialty] = useState('Emergency Medicine & Trauma');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [department, setDepartment] = useState('Emergency Department - Triage Center');
  const [dob, setDob] = useState('1992-04-18');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [emergencyContact, setEmergencyContact] = useState('(555) 234-8901');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Instant 1-Click Launch (Direct Session Sign-in)
  const handleInstantLaunch = (targetRole: UserRole) => {
    let emailToFind = 'sarah.patient@ervision.health';
    if (targetRole === 'nurse') emailToFind = 'marcus.nurse@ervision.health';
    if (targetRole === 'doctor') emailToFind = 'elena.doctor@ervision.health';

    let user = storage.findUserByEmail(emailToFind);
    if (!user) {
      const all = storage.getUsers();
      user = all.find((u) => u.role === targetRole);
    }

    if (user) {
      storage.setSession({
        user,
        token: 'instant_token_' + Math.random().toString(36).substring(2),
        loginAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      onLoginSuccess(user);
    }
  };

  // Quick fill helper for manual form testing
  const handleQuickFill = (targetRole: UserRole) => {
    setMode('signup');
    setRole(targetRole);
    setErrorMessage(null);

    if (targetRole === 'patient') {
      setName('Sarah Connor');
      setEmail('sarah.patient@ervision.health');
      setPassword('ERVision2026!');
      setDob('1992-04-18');
      setBloodGroup('O+');
      setEmergencyContact('(555) 234-8901');
    } else if (targetRole === 'nurse') {
      setName('Marcus Vance, RN');
      setEmail('marcus.nurse@ervision.health');
      setPassword('ERVision2026!');
      setDepartment('Emergency Department - Triage Center');
      setLicenseNumber('RN-74892');
    } else if (targetRole === 'doctor') {
      setName('Dr. Elena Rostova, MD');
      setEmail('elena.doctor@ervision.health');
      setPassword('ERVision2026!');
      setSpecialty('Emergency Medicine & Trauma');
      setLicenseNumber('MD-49821');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const user = storage.findUserByEmail(email.trim());
      if (!user) {
        setErrorMessage('No registered account found with this email. Click "Create Account" or use the 1-click role quick-fill above.');
        setIsSubmitting(false);
        return;
      }

      const inputHash = await hashPassword(password);
      if (user.passwordHash !== inputHash) {
        setErrorMessage('Invalid password. Please check your credentials or reset via Forgot Password.');
        setIsSubmitting(false);
        return;
      }

      const session = {
        token: 'sess_' + Math.random().toString(36).substring(2, 12),
        user,
        loginAt: new Date().toISOString(),
      };
      storage.setSession(session);
      onLoginSuccess(user);
    } catch {
      setErrorMessage('An unexpected authentication error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    const existing = storage.findUserByEmail(email.trim());
    if (existing) {
      setErrorMessage('An account with this email address already exists. Please sign in.');
      return;
    }

    setIsSubmitting(true);
    try {
      const passwordHash = await hashPassword(password);
      const newUser: User = {
        id: 'usr_' + Math.random().toString(36).substring(2, 10),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
        createdAt: new Date().toISOString(),
      };

      if (role === 'doctor') {
        newUser.specialty = specialty;
        newUser.licenseNumber = licenseNumber.trim() || `MD-LIC-${Math.floor(10000 + Math.random() * 90000)}`;
        newUser.department = 'Clinical Medicine & Surgery';
      } else if (role === 'nurse') {
        newUser.department = department;
        newUser.licenseNumber = licenseNumber.trim() || `RN-LIC-${Math.floor(10000 + Math.random() * 90000)}`;
      } else if (role === 'patient') {
        newUser.dob = dob || '1990-01-01';
        newUser.bloodGroup = bloodGroup;
        newUser.emergencyContact = emergencyContact;
      }

      storage.saveUser(newUser);

      const session = {
        token: 'sess_' + Math.random().toString(36).substring(2, 12),
        user: newUser,
        loginAt: new Date().toISOString(),
      };
      storage.setSession(session);
      onLoginSuccess(newUser);
    } catch {
      setErrorMessage('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/70 via-slate-50/40 to-white text-slate-800 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between border-b border-sky-100/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-sm text-white">
            <HeartPulse className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight text-slate-900">
                ER <span className="text-sky-600 font-extrabold">Vision</span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Hospital OS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Integrated Emergency Care & Patient Ecosystem
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <a
            href="tel:911"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold transition-colors shadow-xs"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Emergency: 911</span>
          </a>
        </div>
      </nav>

      {/* ================= SECTION 1: LOGIN BOX UPSIDE ================= */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-100/90 text-sky-800 border border-sky-200 text-xs font-bold mb-3 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>Intelligent Hospital Management & Clinical Triage</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Sign In to <span className="text-sky-600">ER Vision</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Instant secure access to your clinical workspace. Click a role below for fast 1-click testing or enter your account credentials.
          </p>
        </div>

        {/* 1-Click Fast Role Selectors (Upside for instant convenience) */}
        <div className="max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
            <span className="flex items-center space-x-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Instant 1-Click Role Launch (Zero Typing):</span>
            </span>
            <span className="text-sky-600 font-semibold lowercase">instant session</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div
              className={`p-3 sm:p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                role === 'patient' && mode === 'signup'
                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-emerald-300 shadow-xs'
              }`}
            >
              <div>
                <div className="h-8 w-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto mb-1.5">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-slate-900">Patient</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Sarah Connor</div>
              </div>
              <button
                type="button"
                onClick={() => handleInstantLaunch('patient')}
                className="mt-2.5 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] sm:text-[11px] shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                title="Launch directly into Patient Portal"
              >
                <Zap className="h-3 w-3" />
                <span>Launch (1-Click)</span>
              </button>
            </div>

            <div
              className={`p-3 sm:p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                role === 'nurse' && mode === 'signup'
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-amber-300 shadow-xs'
              }`}
            >
              <div>
                <div className="h-8 w-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center mx-auto mb-1.5">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-slate-900">Triage Nurse</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Marcus Vance, RN</div>
              </div>
              <button
                type="button"
                onClick={() => handleInstantLaunch('nurse')}
                className="mt-2.5 py-1 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] sm:text-[11px] shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                title="Launch directly into Triage Nurse Portal"
              >
                <Zap className="h-3 w-3" />
                <span>Launch (1-Click)</span>
              </button>
            </div>

            <div
              className={`p-3 sm:p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                role === 'doctor' && mode === 'signup'
                  ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200 shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-sky-300 shadow-xs'
              }`}
            >
              <div>
                <div className="h-8 w-8 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center mx-auto mb-1.5">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-slate-900">Physician</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Dr. Elena Rostova</div>
              </div>
              <button
                type="button"
                onClick={() => handleInstantLaunch('doctor')}
                className="mt-2.5 py-1 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] sm:text-[11px] shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                title="Launch directly into Physician Portal"
              >
                <Zap className="h-3 w-3" />
                <span>Launch (1-Click)</span>
              </button>
            </div>
          </div>
        </div>

        {/* The Authentication Card (Upside) */}
        <div className="max-w-md mx-auto bg-white border border-sky-100/90 rounded-3xl p-6 sm:p-7 shadow-xl shadow-sky-100/60">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100/80 p-1 rounded-2xl mb-5 border border-slate-200/70">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`w-1/2 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`w-1/2 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. physician@ervision.health"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 font-bold text-white text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Enter ER Vision Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={handleSignUp} className="space-y-3.5">
              {/* Role Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Selected Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      role === 'patient'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('nurse')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      role === 'nurse'
                        ? 'bg-amber-50 border-amber-400 text-amber-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Triage Nurse
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('doctor')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      role === 'doctor'
                        ? 'bg-sky-50 border-sky-400 text-sky-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Physician
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Elena Rostova or Sarah Connor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-sky-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@ervision.health"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-sky-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create secure password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-sky-500"
                />
              </div>

              {/* Role specific inputs */}
              {role === 'doctor' && (
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Specialty</label>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                    >
                      <option value="Emergency Medicine & Trauma">Emergency & Trauma</option>
                      <option value="Cardiology & Critical Care">Cardiology & ICU</option>
                      <option value="Internal Medicine">Internal Medicine</option>
                      <option value="Orthopedic Surgery">Orthopedics</option>
                      <option value="Pediatrics">Pediatrics</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">License ID</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="MD-49821"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              {role === 'nurse' && (
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Station</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                    >
                      <option value="Emergency Department - Triage Center">Emergency Triage</option>
                      <option value="Trauma & Resuscitation Unit">Trauma & Resus</option>
                      <option value="Rapid Care & Observation Bay">Rapid Care</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nurse Badge</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="RN-74892"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              {role === 'patient' && (
                <div className="grid grid-cols-3 gap-2 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">DOB</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 text-xs text-slate-900"
                    >
                    </input>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 text-xs text-slate-900"
                    >
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="O+">O+</option>
                      <option value="AB+">AB+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Emergency Tel</label>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="(555) 0192"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-white text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? <span>Creating Account...</span> : <span>Complete Registration & Enter</span>}
              </button>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Zero Mock Records · Real Client Storage</span>
          </div>
        </div>
      </section>

      {/* ================= SECTION 2: DETAILS DOWN BELOW ================= */}
      <section className="bg-gradient-to-b from-sky-50/50 via-slate-50/80 to-white border-t border-sky-100/90 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header of Details */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 bg-sky-100/80 px-3 py-1 rounded-full border border-sky-200 shadow-xs">
              Complete Hospital Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              About ER Vision Hospital OS
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ER Vision bridges the gap between patient emergency self-assessment, triage nurse acuity prioritization, and physician clinical decision support using real-time browser storage and clinical AI.
            </p>
          </div>

          {/* 3 Core Pillars in Depth */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="bg-white p-6 rounded-3xl border border-emerald-100/90 shadow-sm space-y-3.5 hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                <UserIcon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">1. Patient Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Empowers patients with natural language AI symptom checking, automated emergency red-flag identification, specialist appointment scheduling, and plain-English medical summaries.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Interactive AI symptom triage analyzer</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Real-time appointment booking & reschedule</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Prescription tracker with 1-click adherence</span>
                </li>
              </ul>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white p-6 rounded-3xl border border-amber-100/90 shadow-sm space-y-3.5 hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">2. Triage Nurse & ER Department</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Engineered for rapid intake of walk-ins and ambulance arrivals. Features automated MEWS scoring, priority heap sorting, AI deterioration checks, and live treatment bay management.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Automated MEWS & Shock Index calculation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Dynamic heap priority queue (ESI 1 to 5)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>12-bay ER bed allocation & sanitization matrix</span>
                </li>
              </ul>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white p-6 rounded-3xl border border-sky-100/90 shadow-sm space-y-3.5 hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">3. Physician Clinical Decision Desk</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Provides physicians with instant patient chart access, embedded AI Clinical Decision Support (CDS) with differential diagnoses and drug-allergy alerts, dictation-to-SOAP scribe, and STAT diagnostic orders.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <span>Differential diagnoses ranked by probability</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <span>Shorthand dictation formatted into formal SOAP notes</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <span>STAT Cardiac, Sepsis, and Imaging order sets</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Clinical Flow Journey */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Layers className="h-4 w-4 text-sky-600" />
              <span>How It Works: Connected Emergency Journey</span>
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Experience the end-to-end hospital workflow without confusion.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100">
                <div className="text-[11px] font-bold text-sky-700 uppercase mb-1">Step 1 · Intake & Triage</div>
                <div className="text-xs font-semibold text-slate-900 mb-1">Symptom Assessment</div>
                <p className="text-[11px] text-slate-600">
                  Patient or triage nurse records vitals. The ESI heap algorithm calculates acuity and Shock Index immediately.
                </p>
              </div>
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                <div className="text-[11px] font-bold text-amber-700 uppercase mb-1">Step 2 · Care Allocation</div>
                <div className="text-xs font-semibold text-slate-900 mb-1">Bay & AI Risk Check</div>
                <p className="text-[11px] text-slate-600">
                  Triage team assigns an available treatment bay and AI flags hidden deterioration risks before vital crashes occur.
                </p>
              </div>
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <div className="text-[11px] font-bold text-emerald-700 uppercase mb-1">Step 3 · Clinical Care</div>
                <div className="text-xs font-semibold text-slate-900 mb-1">CDS, Notes & Discharge</div>
                <p className="text-[11px] text-slate-600">
                  Attending physician reviews chart with AI differential CDS, writes orders, signs digital SOAP notes, and discharges safely.
                </p>
              </div>
            </div>
          </div>

          {/* Operational Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <span className="text-2xl font-black text-sky-600">ESI 1-5</span>
              <p className="text-xs text-slate-500 mt-0.5">Emergency Severity Index</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <span className="text-2xl font-black text-emerald-600">100%</span>
              <p className="text-xs text-slate-500 mt-0.5">Client Browser Storage</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <span className="text-2xl font-black text-indigo-600">Gemini</span>
              <p className="text-xs text-slate-500 mt-0.5">Clinical Reasoning AI</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <span className="text-2xl font-black text-amber-600">12 Bays</span>
              <p className="text-xs text-slate-500 mt-0.5">Live Treatment Matrix</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
        <p>© 2026 ER Vision Hospital OS. Grounded in Emergency Severity Index standards.</p>
        <div className="flex items-center space-x-4">
          <span>Triage ESI v4</span>
          <span>·</span>
          <span>MEWS Scoring</span>
          <span>·</span>
          <span>HIPAA Client Encryption</span>
        </div>
      </footer>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
};
