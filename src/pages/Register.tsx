import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Upload, Image as ImageIcon, Check, ArrowRight, UserPlus, FileCheck } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';

interface ParentInfo {
  id: string;
  fullName: string;
  role: 'admin' | 'manager' | 'agent' | 'subagent';
}

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const parentId = searchParams.get('parent_id') || searchParams.get('parentId') || '';

  // Parent profile metadata state
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [parentLoading, setParentLoading] = useState(true);
  const [parentError, setParentError] = useState('');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [idPhotoName, setIdPhotoName] = useState<string>('');

  // UI state managers
  const [dragActive, setDragActive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Parse invite ID on load
  useEffect(() => {
    const fetchParentDetails = async () => {
      if (!parentId) {
        setParentError('Invalid link. An invitation requires a parent_id referrer.');
        setParentLoading(false);
        return;
      }

      try {
        const response = await api.get(API_ENDPOINTS.auth.parentInfo(parentId));
        if (response.data?.success && response.data?.data) {
          setParent(response.data.data);
        } else {
          setParentError('Could not retrieve parent user profiles.');
        }
      } catch (err: any) {
        console.error('Failed to retrieve parent registry:', err);
        setParentError(err.response?.data?.message || 'The inviter ID does not exist or has been suspended.');
      } finally {
        setParentLoading(false);
      }
    };

    fetchParentDetails();
  }, [parentId]);

  // Translate role to determine user target assignment
  const getRecruitedRole = (): 'manager' | 'agent' | 'subagent' | 'unknown' => {
    if (!parent) return 'unknown';
    if (parent.role === 'admin') return 'manager';
    if (parent.role === 'manager') return 'agent';
    return 'subagent'; // Agents and Sub-agents recruit Sub-agents
  };

  const jointRole = getRecruitedRole();

  // Age 18+ confirmation
  const validateAge = (birthDateString: string): boolean => {
    if (!birthDateString) return false;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  // Convert uploaded photo to base64
  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setFieldErrors(prev => ({ ...prev, idPhoto: 'Only JPEG, PNG, and PDF file sheets are approved.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setIdPhoto(reader.result as string);
      setIdPhotoName(file.name);
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy.idPhoto;
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim()) errors.fullName = 'Full Name is required.';
    
    if (!dob) {
      errors.dob = 'Date of birth is required.';
    } else if (!validateAge(dob)) {
      errors.dob = 'You must be at least 18 years old to join Zenon Plus.';
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!idPhoto) {
      errors.idPhoto = 'Verification ID Photo is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!validateForm() || !parent) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        dob,
        password,
        idPhoto,
        parentId: parent.id,
      };

      const response = await api.post(API_ENDPOINTS.auth.register, payload);
      if (response.data?.success) {
        setIsSuccess(true);
      }
    } catch (err: any) {
      console.error('Downline registration failed:', err);
      setFormError(err.response?.data?.message || 'Failed to submit registration files. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (parentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-transparent border-t-blue-600"></div>
          <p className="text-sm text-slate-500 font-medium">Parsing team invitation details...</p>
        </div>
      </div>
    );
  }

  if (parentError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100">
            <Check className="h-6 w-6 stroke-[3] rotate-45" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-slate-900">Link Unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">{parentError}</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100 animate-bounce">
            <FileCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Registration Submitted</h2>
          
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-left border border-slate-150">
            <p className="text-sm text-slate-650 leading-relaxed">
              Welcome to Zenon Plus. Your ID documentation has been successfully uploaded.{' '}
              <span className="font-semibold text-slate-900">{parent?.fullName || 'Your manager'}</span> has been notified to inspect and activate your account.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Sign back in
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Brand header */}
        <div className="text-center select-none">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-mono font-black text-xl leading-none">
            Z
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">Join Zenon Plus Network</h2>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-md">
          
          {/* Invitation Banner description */}
          <div className="mb-6 rounded-xl bg-blue-50/50 border border-blue-100 p-4 flex flex-col gap-1 text-sm text-blue-900">
            <p className="font-semibold">Team Invitation</p>
            <p className="text-blue-800 text-xs leading-relaxed">
              You have been invited to join <span className="font-bold">{parent?.fullName}</span>'s team on Zenon Plus.{' '}
              You are joining as an <span className="font-bold uppercase tracking-wider text-blue-750 font-mono">{jointRole}</span>.
            </p>
          </div>

          {formError && (
            <div className="mb-6 rounded-lg border border-rose-150 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
              {formError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleRegisterSubmit}>
            
            {/* Full Name field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ruwan Gunawardena"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-850 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* DOB Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date of Birth
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
              </div>
              {fieldErrors.dob && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.dob}</p>
              )}
            </div>

            {/* Password Row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Photo upload drag Active */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Verification Identity Photo
              </label>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/20'
                    : idPhoto
                    ? 'border-emerald-300 bg-emerald-50/10'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                }`}
              >
                {idPhoto ? (
                  <div className="flex flex-col items-center gap-3">
                    {idPhoto.startsWith('data:image') ? (
                      <div className="h-24 w-36 overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={idPhoto}
                          referrerPolicy="no-referrer"
                          alt="Verification Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <span className="text-xs text-emerald-800 font-semibold">{idPhotoName || 'ID file uploaded'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIdPhoto(null);
                        setIdPhotoName('');
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-1.5 text-xs text-slate-600 font-medium">
                      Drag files or{' '}
                      <label className="cursor-pointer font-bold text-blue-650 hover:underline">
                        <span>browse</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="sr-only"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                          }}
                        />
                      </label>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, PDF up to 5MB</p>
                  </div>
                )}
              </div>
              {fieldErrors.idPhoto && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.idPhoto}</p>
              )}
            </div>

            {/* Actions */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:bg-blue-400 cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Register in Team'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
