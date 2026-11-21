import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/logo.png';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Gift, Sun, Moon, Loader2, Building2, MapPin, CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react';

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Wake the API while the user is typing — if the server was idle, its cold start
  // (~20s in production) happens now instead of after clicking Sign In.
  useEffect(() => {
    api.get('/Health').catch(() => {});
  }, []);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isSubmittingTrial, setIsSubmittingTrial] = useState(false);
  const [trialForm, setTrialForm] = useState({
    companyName: '',
    ownerName: '',
    ownerEmail: '',
    ownerContact: '',
    city: '',
    state: '',
    country: 'India',
    industry: '',
    staffLimit: 10,
    adminPassword: ''
  });

  const handleTrialSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingTrial(true);
    try {
      const response = await api.post('/TrialRequest/request', trialForm);
      toast.success(response.data.message || 'Trial request submitted successfully!', { duration: 6000 });
      setIsTrialModalOpen(false);
      setTrialForm({
        companyName: '', ownerName: '', ownerEmail: '', ownerContact: '',
        city: '', state: '', country: 'India', industry: '', staffLimit: 10, adminPassword: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit trial request.');
    } finally {
      setIsSubmittingTrial(false);
    }
  };

  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await authService.login(data.email, data.password);
      if (response && response.token) {
        // "SubAdmin" gets the same admin portal/UI as "Admin"; the flag only changes the displayed label.
        const isSubAdmin = response.role === 'SubAdmin';
        const userRole = isSubAdmin ? 'Admin' : response.role;
        login({
          id: response.id, email: data.email, role: userRole, isSubAdmin,
          permissions: response.permissions, companyName: response.companyName,
          enabledModules: response.enabledModules !== undefined && response.enabledModules !== null ? response.enabledModules : 'STS',
          isTrial: response.isTrial,
          accountType: response.accountType,
          subscriptionExpiry: response.subscriptionExpiry,
          trialEndDate: response.trialEndDate,
          companyIsActive: response.companyIsActive
        }, response.token);
        toast.success("Welcome back!");
        if (userRole === 'SuperAdmin') navigate('/superadmin');
        else if (userRole === 'Admin') navigate('/admin');
        else navigate('/sales');
      }
    } catch (error) {
      console.error("Login failed", error);
      toast.error(error.response?.data?.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark';

  /* ─── Feature icons ─── */
  const CrosshairIcon = () => (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  );
  const ChartIcon = () => (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="6" width="4" height="15" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
    </svg>
  );
  const TeamIcon = () => (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="3"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
      <circle cx="19" cy="9" r="2.5"/><path d="M22 21a4.5 4.5 0 0 0-4.5-4.5"/>
      <circle cx="5" cy="9" r="2.5"/><path d="M2 21a4.5 4.5 0 0 1 4.5-4.5"/>
    </svg>
  );

  /* ─── Dot grid 5×5 ─── */
  const DotGrid = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '7px' }}>
      {[...Array(25)].map((_, i) => (
        <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(120,170,255,0.45)' }}></div>
      ))}
    </div>
  );

  const features = [
    { Icon: CrosshairIcon, title: 'Real-time Tracking', desc: 'Monitor activities and performance in real time.' },
    { Icon: ChartIcon, title: 'Smart Reports', desc: 'Get actionable insights and make better decisions.' },
    { Icon: TeamIcon, title: 'Team Management', desc: 'Manage your team and drive productivity efficiently.' },
  ];

  return (
    <div className="login-root" style={{ display: 'flex', width: '100%', fontFamily: "'Inter', sans-serif" }}>
      {/* Phone / tablet polish — desktop keeps the original look */}
      <style>{`
        /* dvh = the visible viewport on phones, so the page isn't taller than the screen behind the browser toolbars */
        .login-root, .login-right { min-height: 100vh; min-height: 100dvh; }
        @media (max-width: 1023px) {
          .login-logo-img { height: 64px !important; }
          .login-logo-wrap { margin-bottom: 14px !important; }
          .login-heading { margin-bottom: 18px !important; }
          .login-card {
            background: ${isDark ? 'rgba(13, 24, 42, 0.78)' : 'rgba(255, 255, 255, 0.95)'} !important;
            -webkit-backdrop-filter: blur(20px);
            backdrop-filter: blur(20px);
            border: 1px solid ${isDark ? 'rgba(120, 170, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)'} !important;
            border-radius: 26px !important;
            box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
            position: relative;
            overflow: hidden;
          }
          .login-card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, #1460b8, #3388ff, #5ea3ff);
          }
          .login-input { font-size: 16px !important; height: 54px !important; border-radius: 14px !important; }
          .login-btn { height: 54px !important; border-radius: 14px !important; font-size: 16px !important; }
          .login-theme {
            background: rgba(255, 255, 255, 0.10) !important;
            border-color: rgba(255, 255, 255, 0.18) !important;
            -webkit-backdrop-filter: blur(10px);
            backdrop-filter: blur(10px);
          }
          .login-theme button { color: #cfe0f7 !important; }
          .login-remember { width: 18px !important; height: 18px !important; }
          .login-card { animation: mCardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .login-card::before { background-size: 200% 100%; animation: mShimmer 3.5s linear infinite; }
          .m-head { animation: mFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .m-sts { animation: mGlow 3.2s ease-in-out infinite; }
          .login-input:focus { transform: translateY(-1px); }
          .login-btn:active { transform: scale(0.98) !important; }
          /* Lock to exactly one screen — no page scroll */
          .login-root, .login-right { height: 100vh; height: 100dvh; min-height: 0 !important; overflow: hidden; }
          .login-card { padding: clamp(14px, 2.4dvh, 24px) clamp(16px, 5vw, 32px) !important; }
          .login-card form > div:nth-child(1), .login-card form > div:nth-child(2) { margin-bottom: clamp(8px, 1.6dvh, 16px) !important; }
          .login-card form > div:nth-child(3) { margin-bottom: clamp(10px, 2dvh, 18px) !important; }
          .login-card form > div:nth-child(5) { margin: clamp(10px, 1.8dvh, 18px) 0 !important; }
          .login-input, .login-btn { height: clamp(44px, 6.4dvh, 54px) !important; }
          .login-logo-img { height: clamp(40px, 6.5dvh, 60px) !important; }
          .login-heading { margin-bottom: clamp(10px, 2dvh, 18px) !important; }
          .login-heading h2 { font-size: clamp(1.25rem, 3.2dvh, 1.6rem) !important; }
          .m-head { padding-top: 0 !important; }
          .m-foot { padding-bottom: 10px !important; padding-top: 4px !important; }
          .m-strip { display: flex; padding-bottom: 0 !important; gap: 8px !important; }
          .m-feat { padding: 6px 4px !important; gap: 3px !important; border-radius: 12px !important; }
          .m-feat-ic { transform: none !important; margin: 0 !important; }
          .m-feat-ic svg { width: 16px; height: 16px; }
          .m-feat span:last-child { font-size: 10px !important; }
          .m-foot { font-size: 10px !important; line-height: 1.3; }
          /* Compact theme switch */
          .m-theme-row { padding-top: 10px !important; }
          .login-theme { padding: 2px !important; }
          .login-theme button { padding: 4px 10px !important; font-size: 11px !important; gap: 4px !important; }
          .login-theme button svg { width: 11px; height: 11px; }
          .login-card form > * { animation: mFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .login-card form > *:nth-child(1) { animation-delay: 0.25s; }
          .login-card form > *:nth-child(2) { animation-delay: 0.33s; }
          .login-card form > *:nth-child(3) { animation-delay: 0.41s; }
          .login-card form > *:nth-child(4) { animation-delay: 0.49s; }
          .login-card form > *:nth-child(5) { animation-delay: 0.57s; }
          .login-card form > *:nth-child(6) { animation-delay: 0.65s; }
          .m-shine { overflow: hidden; }
          .m-shine::after {
            content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -60%;
            background: linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent);
            transform: skewX(-18deg); animation: mBtnShine 3.8s ease-in-out infinite; pointer-events: none;
          }
          .m-live { animation: mFadeUp 0.7s 0.15s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .m-feat { animation: mFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        }
        @media (max-width: 1023px) and (max-height: 780px) { .m-strip { display: none !important; } }
        @media (max-width: 1023px) and (max-height: 690px) { .m-live { display: none !important; } .m-sts { font-size: 2rem !important; } }
        @media (max-width: 1023px) and (max-height: 600px) {
          /* Very short screens: let the page scroll rather than clip the form */
          .login-root, .login-right { height: auto !important; min-height: 100dvh !important; overflow: visible !important; }
        }
        /* Animated mobile background */
        .mbg-orb { position: absolute; border-radius: 50%; filter: blur(56px); will-change: transform; }
        .mbg-orb-1 { width: 280px; height: 280px; top: -70px; right: -90px; background: radial-gradient(circle, rgba(51,136,255,0.75), rgba(51,136,255,0) 70%); animation: mFloatA 14s ease-in-out infinite; }
        .mbg-orb-2 { width: 320px; height: 320px; bottom: -110px; left: -110px; background: radial-gradient(circle, rgba(99,102,241,0.6), rgba(99,102,241,0) 70%); animation: mFloatB 17s ease-in-out infinite; }
        .mbg-orb-3 { width: 200px; height: 200px; top: 38%; left: 55%; background: radial-gradient(circle, rgba(34,211,238,0.35), rgba(34,211,238,0) 70%); animation: mFloatC 12s ease-in-out infinite; }
        .mbg-bar { transform-box: fill-box; transform-origin: bottom; animation: mBarPulse 4.2s ease-in-out infinite; }
        .mbg-line { stroke-dasharray: 1 7; animation: mDash 2.4s linear infinite; }
        .mbg-ping { transform-box: fill-box; transform-origin: center; animation: mPing 2.4s ease-out infinite; }
        .mbg-dot { position: absolute; border-radius: 50%; background: rgba(160,200,255,0.8); box-shadow: 0 0 10px rgba(120,170,255,0.8); animation: mRise linear infinite; opacity: 0; }
        .mbg-sweep { position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(120,170,255,0.08) 50%, transparent 65%); background-size: 250% 100%; animation: mSweep 9s ease-in-out infinite; }
        .mbg-chip {
          position: absolute; display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: #e6f0ff;
          background: rgba(255,255,255,0.09); border: 1px solid rgba(160,200,255,0.25);
          -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
          box-shadow: 0 8px 24px -8px rgba(0,0,0,0.5); animation: mChip 7s ease-in-out infinite; white-space: nowrap;
        }
        .mbg-chip i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .mbg-grow { stroke-dasharray: 700; stroke-dashoffset: 700; animation: mGrow 6s ease-in-out infinite; }
        .mbg-area { opacity: 0; animation: mAreaIn 6s ease-in-out infinite; }
        .m-livedot { animation: mLive 1.6s ease-out infinite; }
        .m-feat-ic { transition: transform 0.2s; }
        .m-feat:active .m-feat-ic { transform: scale(0.92); }
        @keyframes mChip { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-14px) rotate(1deg); } }
        @keyframes mGrow { 0% { stroke-dashoffset: 700; } 55%,85% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -700; } }
        @keyframes mAreaIn { 0%,10% { opacity: 0; } 55%,85% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes mLive { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.7); } 100% { box-shadow: 0 0 0 9px rgba(52,211,153,0); } }
        @keyframes mBtnShine { 0%,55% { left: -60%; } 100% { left: 130%; } }
        @keyframes mFloatA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,60px) scale(1.15); } }
        @keyframes mFloatB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,-50px) scale(1.12); } }
        @keyframes mFloatC { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px,40px); } }
        @keyframes mBarPulse { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.82); } }
        @keyframes mDash { to { stroke-dashoffset: -16; } }
        @keyframes mPing { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes mRise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 0.8; } 100% { transform: translateY(-85vh); opacity: 0; } }
        @keyframes mSweep { 0% { background-position: 150% 0; } 100% { background-position: -100% 0; } }
        @keyframes mShimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
        @keyframes mCardIn { from { opacity: 0; transform: translateY(28px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes mFadeUp { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
        @keyframes mGlow { 0%,100% { text-shadow: 0 4px 24px rgba(51,136,255,0.45); } 50% { text-shadow: 0 4px 34px rgba(94,163,255,0.95); } }
        @media (prefers-reduced-motion: reduce) {
          .login-card, .login-card::before, .login-card form > *, .m-head, .m-sts, .m-live, .m-feat, .m-livedot, .m-shine::after, .mbg-orb, .mbg-bar, .mbg-line, .mbg-ping, .mbg-dot, .mbg-sweep, .mbg-chip, .mbg-grow, .mbg-area { animation: none !important; }
          .mbg-grow { stroke-dashoffset: 0; } .mbg-area { opacity: 1; }
          .mbg-dot { opacity: 0.4; }
        }
      `}</style>


      {/* ═══════════════════════════════════════════════════════
          LEFT PANEL — Dark navy branding
          ═══════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex" style={{
        width: '50%', minHeight: '100vh', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, #060d1f 0%, #0b1a3e 30%, #122e6b 65%, #1a42a0 100%)',
        flexDirection: 'column',
      }}>

        {/* SVG Wave */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox="0 0 600 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="waveG" x1="0.4" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1a55c0" stopOpacity="0.65"/>
              <stop offset="60%" stopColor="#2070ee" stopOpacity="0.45"/>
              <stop offset="100%" stopColor="#2b88ff" stopOpacity="0.25"/>
            </linearGradient>
          </defs>
          <path d="M380,-60 C400,80 510,180 490,340 C470,500 530,600 490,750 C450,900 540,960 600,960 L600,-60 Z" fill="url(#waveG)"/>
          <path d="M440,-20 C460,130 550,230 530,390 C510,540 570,640 530,790 C500,920 570,960 600,960 L600,-20 Z" fill="rgba(35,105,255,0.12)"/>
        </svg>

        {/* Ambient ring decorations */}
        <div style={{ position: 'absolute', top: '-10%', right: '-14%', width: '520px', height: '520px', borderRadius: '50%', border: '1px solid rgba(90,150,255,0.12)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', bottom: '-16%', right: '-8%', width: '620px', height: '620px', borderRadius: '50%', border: '1px solid rgba(90,150,255,0.07)', pointerEvents: 'none' }}></div>

        {/* Dot grids */}
        <div style={{ position: 'absolute', top: '28px', right: '18%', zIndex: 10, pointerEvents: 'none' }}><DotGrid /></div>
        <div style={{ position: 'absolute', bottom: '28px', left: '24px', zIndex: 10, pointerEvents: 'none' }}><DotGrid /></div>

        {/* ═══ CONTENT ═══ */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '36px 44px 40px' }}>

          {/* ── LOGO (no white bg — blend mode removes it) ── */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              display: 'inline-block',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.35)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              padding: '10px 18px',
            }}>
              <img
                src={logo}
                alt="IDeaspromo Solutions Pvt. Ltd."
                style={{ height: '72px', width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>

          {/* ── MAIN STS SECTION (enlarged to fill space) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '480px', paddingTop: '8px' }}>

            {/* STS title — very large */}
            <h1 style={{
              fontSize: 'clamp(4rem, 6vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 0.95,
              color: '#3388ff',
              marginBottom: '6px',
              letterSpacing: '-0.02em',
              textShadow: '0 0 40px rgba(51,136,255,0.25)',
            }}>
              STS
            </h1>

            <h2 style={{
              fontSize: 'clamp(1.5rem, 2.5vw, 2.2rem)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.15,
              marginBottom: '16px',
              letterSpacing: '0.01em',
            }}>
              Sales Tracking System
            </h2>

            {/* Blue accent bar */}
            <div style={{ width: '48px', height: '4px', borderRadius: '2px', background: 'linear-gradient(90deg, #2b7fff, #5ea3ff)', marginBottom: '32px' }}></div>

            {/* Tagline block */}
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '0.04em', marginBottom: '10px' }}>
              Track. Monitor. Grow.
            </p>
            <p style={{ color: '#8ba8cc', fontSize: '0.92rem', lineHeight: 1.7, maxWidth: '400px', marginBottom: '20px' }}>
              Empower your sales team with real-time insights, intelligent reporting and seamless field force management.
            </p>

            {/* Extra professional info line */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(43,127,255,0.08)', border: '1px solid rgba(43,127,255,0.18)',
              borderRadius: '8px', padding: '8px 16px', marginBottom: '0',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3388ff', boxShadow: '0 0 8px rgba(51,136,255,0.6)' }}></div>
              <span style={{ color: '#a0c0e8', fontSize: '0.78rem', fontWeight: 500 }}>
                Trusted by 500+ field teams across India
              </span>
            </div>
          </div>

          {/* ── BOTTOM FEATURES ── */}
          <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', borderTop: '1px solid rgba(43,127,255,0.12)', paddingTop: '28px' }}>
            {features.map(({ Icon, title, desc }, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  width: '58px', height: '58px', borderRadius: '50%',
                  border: '1.5px solid rgba(59,140,255,0.3)',
                  background: 'rgba(10,30,70,0.6)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '12px', color: '#4a9bff',
                  boxShadow: '0 0 20px rgba(40,100,255,0.08)',
                }}>
                  <Icon />
                </div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>{title}</h3>
                <p style={{ fontSize: '0.73rem', color: '#7a9cc0', lineHeight: 1.45 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          RIGHT PANEL — Professional light blue / dark login
          ═══════════════════════════════════════════════════════ */}
      <div
        className="w-full lg:w-1/2 login-right"
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: isDark
            ? 'linear-gradient(180deg, #0b1424 0%, #0d1a2e 50%, #0f1e36 100%)'
            : 'linear-gradient(160deg, #dce8f8 0%, #e4eefa 40%, #eaf2fd 100%)',
          transition: 'background 0.3s ease',
        }}
      >

        {/* ── Theme toggle ── */}
        <div className="relative z-20 m-theme-row" style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px clamp(14px, 4vw, 32px) 0' }}>
          <div className="login-theme" style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px',
            background: isDark ? '#162035' : '#ffffff',
            border: `1px solid ${isDark ? '#243250' : '#c8d6e5'}`,
            borderRadius: '9999px', padding: '3px',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(100,130,170,0.1)',
          }}>
            <button type="button" onClick={() => isDark && toggleTheme()} className="cursor-pointer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px',
              borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: 'none',
              background: !isDark ? '#eef3fa' : 'transparent',
              color: !isDark ? '#1e3a5f' : '#64748b',
              boxShadow: !isDark ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
            }}>
              <Sun size={13} style={{ color: '#f59e0b' }} /> Light
            </button>
            <div style={{ width: '1px', height: '14px', background: isDark ? '#243250' : '#c8d6e5' }}></div>
            <button type="button" onClick={() => !isDark && toggleTheme()} className="cursor-pointer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px',
              borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: 'none',
              background: isDark ? '#1e293b' : 'transparent',
              color: isDark ? '#e2e8f0' : '#94a3b8',
              boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s',
            }}>
              <Moon size={13} style={{ color: '#60a5fa' }} /> Dark
            </button>
          </div>
        </div>

        {/* ═══ MOBILE / TABLET — branded background + company logo only (desktop shows the left panel) ═══ */}
        <div
          aria-hidden="true"
          className="lg:hidden absolute inset-0 z-0 pointer-events-none"
          style={{ background: 'linear-gradient(150deg, #060d1f 0%, #0b1a3e 35%, #122e6b 70%, #1a55c0 100%)' }}
        >
          <div className="mbg-orb mbg-orb-1"></div>
          <div className="mbg-orb mbg-orb-2"></div>
          <div className="mbg-orb mbg-orb-3"></div>
          <div className="mbg-sweep"></div>
          <span className="mbg-chip" style={{ top: '27%', left: '3%' }}><i style={{ background: '#60a5fa', boxShadow: '0 0 8px #60a5fa' }}></i>New Lead</span>
          <span className="mbg-chip" style={{ top: '46%', right: '2%', animationDelay: '-2.5s' }}><i style={{ background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }}></i>Meeting Fixed</span>
          <span className="mbg-chip" style={{ top: '70%', left: '4%', animationDelay: '-4.5s' }}><i style={{ background: '#34d399', boxShadow: '0 0 8px #34d399' }}></i>Converted</span>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mWave" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2b88ff" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#1a55c0" stopOpacity="0.05"/>
              </linearGradient>
              <linearGradient id="mBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ea3ff" stopOpacity="0.40"/>
                <stop offset="100%" stopColor="#2b7fff" stopOpacity="0"/>
              </linearGradient>
              <pattern id="mGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0H0V28" fill="none" stroke="rgba(120,170,255,0.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="400" height="800" fill="url(#mGrid)"/>
            <path d="M200,-40 C260,120 380,160 360,340 C340,520 420,640 420,840 L420,-40 Z" fill="url(#mWave)"/>
            <circle cx="360" cy="60" r="150" fill="none" stroke="rgba(90,150,255,0.14)"/>
            <circle cx="30" cy="740" r="190" fill="none" stroke="rgba(90,150,255,0.10)"/>
            {[0,1,2,3,4,5,6,7,8].map((i) => {
              const h = 60 + i * 28;
              return <rect key={i} className="mbg-bar" style={{ animationDelay: `${i * 0.35}s` }} x={20 + i * 24} y={800 - h} width="13" height={h} rx="3" fill="url(#mBar)"/>;
            })}
            <polyline points="26,720 74,690 122,702 170,640 218,616 266,560 314,520" fill="none" stroke="rgba(94,163,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mbg-line"/>
            <path className="mbg-area" d="M26,780 L26,700 C90,690 130,640 180,600 S270,520 330,470 L330,780 Z" fill="url(#mBar)"/>
            <path className="mbg-grow" d="M26,700 C90,690 130,640 180,600 S270,520 330,470" fill="none" stroke="#5ea3ff" strokeWidth="2.5" strokeLinecap="round"/>
            <path id="mRoute" d="M40,250 C110,200 150,300 220,250 S330,170 370,120" fill="none" stroke="rgba(94,163,255,0.35)" strokeWidth="1.5" strokeDasharray="3 6"/>
            {[[40, 250], [220, 250], [370, 120]].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="#5ea3ff"/>
                <circle cx={x} cy={y} r="9" fill="none" stroke="rgba(94,163,255,0.55)" className="mbg-ping" style={{ animationDelay: `${i * 0.8}s` }}/>
              </g>
            ))}
            <circle r="3.5" fill="#ffffff">
              <animateMotion dur="7s" repeatCount="indefinite"><mpath href="#mRoute"/></animateMotion>
            </circle>
            <circle cx="314" cy="520" r="4" fill="#5ea3ff"/>
            <circle cx="314" cy="520" r="9" fill="none" stroke="rgba(94,163,255,0.6)" className="mbg-ping"/>
          </svg>
          {[
            { l: '12%', s: 4, d: 11, t: 0 }, { l: '28%', s: 3, d: 14, t: 3 }, { l: '46%', s: 5, d: 12, t: 6 },
            { l: '63%', s: 3, d: 15, t: 2 }, { l: '78%', s: 4, d: 10, t: 5 }, { l: '90%', s: 3, d: 13, t: 8 },
          ].map((p, i) => (
            <span key={i} className="mbg-dot" style={{ left: p.l, bottom: '-10px', width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.t}s` }}></span>
          ))}
        </div>

        {/* Centre the product name + login card vertically in the visible screen */}
        <div className="relative z-10" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

        {/* Mobile / tablet header — product name above the login card */}
        <div className="lg:hidden relative z-10 text-center m-head" style={{ padding: '12px 24px 0' }}>
          <h1 className="m-sts" style={{
            fontSize: '2.6rem', fontWeight: 900, lineHeight: 1, letterSpacing: '0.12em',
            color: '#ffffff', textShadow: '0 4px 24px rgba(51,136,255,0.55)',
          }}>
            <span style={{ color: '#4a9bff' }}>S</span>T<span style={{ color: '#4a9bff' }}>S</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
            <span style={{ width: '28px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(125,180,255,0.7))' }}></span>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#a9c8f5' }}>
              Sales Tracking System
            </span>
            <span style={{ width: '28px', height: '1px', background: 'linear-gradient(270deg, transparent, rgba(125,180,255,0.7))' }}></span>
          </div>
          <div className="m-live" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '12px', padding: '5px 12px',
            borderRadius: '999px', background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.28)',
            fontSize: '11px', fontWeight: 600, color: '#a7f3d0',
          }}>
            <span className="m-livedot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399' }}></span>
            Live field tracking
          </div>
        </div>

        {/* ── Login Card ── */}
        <div className="relative z-10" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px clamp(14px, 4vw, 32px)' }}>
          <div className="login-card" style={{
            width: '100%', maxWidth: '440px',
            background: isDark ? '#121d30' : '#ffffff',
            borderRadius: '20px',
            border: `1px solid ${isDark ? '#1e3050' : '#c4d4e8'}`,
            boxShadow: isDark
              ? '0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(30,60,100,0.1)'
              : '0 8px 30px rgba(80,110,160,0.10), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(180,200,230,0.3)',
            padding: 'clamp(24px, 6vw, 40px) clamp(18px, 5vw, 36px)',
            transition: 'all 0.3s ease',
          }}>

            {/* Company logo */}
            <div className="login-logo-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              {/* White badge keeps the logo's dark lettering readable in the dark theme too */}
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '8px 16px', border: `1px solid ${isDark ? '#1e3050' : '#e2e8f0'}` }}>
                <img src={logo} alt="IDeaspromo Solutions Pvt. Ltd." className="login-logo-img" style={{ height: '80px', width: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
            </div>

            {/* Heading */}
            <div className="login-heading" style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: isDark ? '#ffffff' : '#111827', marginBottom: '6px', letterSpacing: '-0.01em' }}>
                Welcome Back!
              </h2>
              <p style={{ fontSize: '0.875rem', color: isDark ? '#6b82a0' : '#6b7280' }}>
                Sign in to continue to STS
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>

              {/* Email */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Mail size={18} strokeWidth={1.75} style={{ color: isDark ? '#4a6585' : '#94a3b8' }} />
                  </div>
                  <input
                    type="email" placeholder="Email address" className="login-input"
                    style={{
                      width: '100%', height: '50px', paddingLeft: '48px', paddingRight: '16px',
                      fontSize: '14px', borderRadius: '12px', outline: 'none',
                      border: `1.5px solid ${errors.email ? '#ef4444' : (isDark ? '#1e3050' : '#c4d4e8')}`,
                      background: isDark ? '#0b1424' : '#f7faff',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#2b7fff'; e.target.style.boxShadow = '0 0 0 3px rgba(43,127,255,0.12)'; e.target.style.background = isDark ? '#0f1a2c' : '#ffffff'; }}
                    onBlur={e => { e.target.style.borderColor = errors.email ? '#ef4444' : (isDark ? '#1e3050' : '#c4d4e8'); e.target.style.boxShadow = 'none'; e.target.style.background = isDark ? '#0b1424' : '#f7faff'; }}
                    {...register('email', { required: "Email is required", pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" } })}
                  />
                </div>
                {errors.email && <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444', paddingLeft: '4px' }}>{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Lock size={18} strokeWidth={1.75} style={{ color: isDark ? '#4a6585' : '#94a3b8' }} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"} placeholder="Password" className="login-input"
                    style={{
                      width: '100%', height: '50px', paddingLeft: '48px', paddingRight: '48px',
                      fontSize: '14px', borderRadius: '12px', outline: 'none',
                      border: `1.5px solid ${errors.password ? '#ef4444' : (isDark ? '#1e3050' : '#c4d4e8')}`,
                      background: isDark ? '#0b1424' : '#f7faff',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#2b7fff'; e.target.style.boxShadow = '0 0 0 3px rgba(43,127,255,0.12)'; e.target.style.background = isDark ? '#0f1a2c' : '#ffffff'; }}
                    onBlur={e => { e.target.style.borderColor = errors.password ? '#ef4444' : (isDark ? '#1e3050' : '#c4d4e8'); e.target.style.boxShadow = 'none'; e.target.style.background = isDark ? '#0b1424' : '#f7faff'; }}
                    {...register('password', { required: "Password is required", minLength: { value: 6, message: "Min 6 characters" } })}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="cursor-pointer"
                    style={{ position: 'absolute', top: 0, bottom: 0, right: '14px', display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: isDark ? '#4a6585' : '#94a3b8' }}>
                    {showPassword ? <EyeOff size={18} strokeWidth={1.75}/> : <Eye size={18} strokeWidth={1.75}/>}
                  </button>
                </div>
                {errors.password && <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444', paddingLeft: '4px' }}>{errors.password.message}</p>}
              </div>

              {/* Remember / Forgot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                <label className="cursor-pointer select-none" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="remember-me" className="cursor-pointer login-remember" style={{ width: '15px', height: '15px', accentColor: '#2b7fff' }} />
                  <span style={{ fontSize: '13px', color: isDark ? '#7a90a8' : '#4b5563' }}>Remember me</span>
                </label>
                <a href="#" onClick={e => { e.preventDefault(); toast("Contact your admin to reset password.", { icon: 'ℹ️' }); }}
                  style={{ fontSize: '13px', fontWeight: 600, color: '#2b7fff', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>

              {/* Sign In */}
              <button type="submit" disabled={isLoading} className="cursor-pointer group login-btn m-shine"
                style={{
                  width: '100%', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  background: 'linear-gradient(135deg, #1460b8 0%, #1975d2 50%, #1e88e5 100%)',
                  color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em',
                  borderRadius: '12px', border: 'none',
                  boxShadow: '0 4px 16px rgba(20,96,184,0.35)',
                  transition: 'all 0.25s ease',
                  opacity: isLoading ? 0.75 : 1,
                }}
                onMouseEnter={e => { if(!isLoading){ e.currentTarget.style.boxShadow='0 6px 24px rgba(20,96,184,0.5)'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(20,96,184,0.35)'; e.currentTarget.style.transform='translateY(0)'; }}
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={18} className="animate-spin" /> Signing in...
                  </span>
                ) : (
                  <>
                    <span style={{ flex: 1, textAlign: 'center' }}>Sign In</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" style={{ position: 'absolute', right: '20px' }} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '22px 0' }}>
                <div style={{ flex: 1, height: '1px', background: isDark ? '#1e3050' : '#c8d8ec' }}></div>
                <span style={{ fontSize: '13px', color: isDark ? '#4a6585' : '#94a3b8', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: '1px', background: isDark ? '#1e3050' : '#c8d8ec' }}></div>
              </div>

              {/* Free Trial */}
              <button type="button" className="cursor-pointer login-btn"
                onClick={() => setIsTrialModalOpen(true)}
                style={{
                  width: '100%', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: 'transparent',
                  border: `1.5px solid ${isDark ? '#1e50a0' : '#1976d2'}`,
                  color: isDark ? '#5b9aff' : '#1976d2',
                  fontWeight: 600, fontSize: '15px', borderRadius: '12px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(30,80,160,0.12)' : 'rgba(25,118,210,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Gift size={18} strokeWidth={1.75} /> Request a Free Trial
              </button>
            </form>
          </div>
        </div>

        {/* Mobile / tablet feature strip (desktop shows these in the left panel) */}
        <div className="lg:hidden relative z-10 m-strip" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '10px', padding: '0 clamp(14px, 4vw, 32px) 0' }}>
          {features.map(({ Icon, title }, idx) => (
            <div key={idx} className="m-feat" style={{
              animationDelay: `${0.8 + idx * 0.12}s`, flex: '1 1 96px', maxWidth: '140px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center',
              padding: '6px 6px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(160,200,255,0.16)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)',
            }}>
              <span className="m-feat-ic" style={{ color: '#7db4ff', display: 'flex', transform: 'scale(0.6)', margin: '-6px 0' }}><Icon /></span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#dbe9ff', lineHeight: 1.2 }}>{title}</span>
            </div>
          ))}
        </div>

        </div>

        {/* Footer */}
        <div
          className={`relative z-10 text-center text-xs px-6 pt-2 pb-5 m-foot text-[#9fb4d1] ${isDark ? 'lg:text-[#4a6585]' : 'lg:text-[#8896a8]'}`}
        >
          Copyright ©{' '}
          <span className="font-semibold text-[#5ea3ff] lg:text-[#2b7fff]">IDeaspromo Solutions Pvt. Ltd.</span>
          {' '}All Rights Reserved.
        </div>
      </div>

      {/* Free Trial Request Modal */}
      {isTrialModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative transition-all">
            
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-5 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                    <Gift className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 text-xs font-black tracking-wide border border-cyan-400/30 uppercase mb-1">
                      <Sparkles className="w-3 h-3 text-cyan-300" /> 7-Day Free Trial
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight">Request Enterprise Trial</h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-3 text-indigo-100 text-sm font-medium leading-relaxed max-w-xl">
                Experience full platform capabilities for 7 days. Submit your property details below for instant Super Admin verification and workspace provisioning.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleTrialSubmit} className="p-5 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Section 1 */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> 1. Company & Property Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Property Name *</label>
                    <input
                      type="text"
                      required
                      value={trialForm.companyName}
                      onChange={e => setTrialForm({ ...trialForm, companyName: e.target.value })}
                      placeholder="e.g. Grand Palace Hotel"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Industry Sector</label>
                    <input
                      type="text"
                      value={trialForm.industry}
                      onChange={e => setTrialForm({ ...trialForm, industry: e.target.value })}
                      placeholder="e.g. Hospitality / Real Estate"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> 2. Owner & Contact Person Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Owner / Manager Full Name *</label>
                    <input
                      type="text"
                      required
                      value={trialForm.ownerName}
                      onChange={e => setTrialForm({ ...trialForm, ownerName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Work Email Address *</label>
                    <input
                      type="email"
                      required
                      value={trialForm.ownerEmail}
                      onChange={e => setTrialForm({ ...trialForm, ownerEmail: e.target.value })}
                      placeholder="john@property.com"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mobile Contact *</label>
                    <input
                      type="text"
                      required
                      value={trialForm.ownerContact}
                      onChange={e => setTrialForm({ ...trialForm, ownerContact: e.target.value })}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Admin Password * (For login once approved)</label>
                    <input
                      type="password"
                      required
                      value={trialForm.adminPassword}
                      onChange={e => setTrialForm({ ...trialForm, adminPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 3. Location & Staff Quota
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={trialForm.city}
                      onChange={e => setTrialForm({ ...trialForm, city: e.target.value })}
                      placeholder="Gorakhpur"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={trialForm.state}
                      onChange={e => setTrialForm({ ...trialForm, state: e.target.value })}
                      placeholder="Uttar Pradesh"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Staff Member Limit</label>
                    <input
                      type="number"
                      min="1"
                      value={trialForm.staffLimit}
                      onChange={e => setTrialForm({ ...trialForm, staffLimit: parseInt(e.target.value) || 10 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTrial}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition-all text-sm disabled:opacity-50"
                >
                  {isSubmittingTrial ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" /> Submit Trial Request
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LoginPage;
