import React, { useState } from 'react';
import { storage } from '../../services/storage';
import { KeyRound, Mail, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRequestToken = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!email.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your registered email address.' });
      return;
    }

    const token = storage.createPasswordResetToken(email.trim());
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'No active account registered with this email. Please verify your address or create an account.',
      });
      return;
    }

    setGeneratedToken(token);
    setInputToken(token); // Auto-fill token for instant user convenience
    setStep('reset');
    setStatusMessage({
      type: 'success',
      text: 'Secure verification token generated! Enter your new password below.',
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Passwords do not match. Please re-enter.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await storage.resetPasswordWithToken(inputToken.trim(), newPassword);
      if (!success) {
        setStatusMessage({
          type: 'error',
          text: 'Invalid or expired recovery token. Please request a new token.',
        });
        setIsSubmitting(false);
        return;
      }

      setStatusMessage({
        type: 'success',
        text: 'Password updated successfully! You can now log in with your new credentials.',
      });
      setTimeout(() => {
        onClose();
        setStep('request');
        setEmail('');
        setNewPassword('');
        setConfirmPassword('');
        setStatusMessage(null);
      }, 1500);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to reset password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Reset Account Password</h3>
            <p className="text-xs text-slate-500">Secure credential recovery workflow</p>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-start space-x-2 border ${
              statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestToken} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. physician@pulsecare.health or patient@mail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 font-bold text-white text-xs sm:text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs"
            >
              <span>Generate Recovery Token</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            {generatedToken && (
              <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 text-xs">
                <span className="text-slate-600">Verification Token Dispatched:</span>{' '}
                <span className="font-mono font-bold text-sky-800">{generatedToken}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Verification Token
              </label>
              <input
                type="text"
                required
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="RESET-XXXXX"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Secure Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-1/3 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs sm:text-sm transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
              >
                {isSubmitting ? <span>Updating...</span> : <span>Confirm New Password</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
