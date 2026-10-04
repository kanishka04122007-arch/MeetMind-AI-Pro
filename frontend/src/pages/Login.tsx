import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  UserPlus, 
  FileText, 
  Mic, 
  Tag, 
  BarChart3,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { authApi } from '../api/auth';

export const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email address and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.login(email.trim(), password);

      // Task 2: Store JWT token in localStorage as localStorage.setItem("token", access_token)
      const access_token = res.access_token || res.token;
      if (access_token) {
        const cleanToken = typeof access_token === 'string'
          ? access_token.trim().replace(/^["']|["']$/g, '')
          : String(access_token);
        localStorage.setItem("token", cleanToken);
      }

      setSuccessMsg(res.welcome_message || `Welcome back, ${res.user.name || 'User'}!`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Invalid email or password. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Decorative Soft Blurs */}
      <div style={styles.ambientBlobTopLeft} />
      <div style={styles.ambientBlobBottomRight} />

      <div style={styles.layoutWrapper}>
        {/* ================= LEFT COLUMN: HERO SHOWCASE ================= */}
        <div style={styles.leftCol}>
          {/* Logo Header */}
          <div style={styles.logoHeader}>
            <Logo size="md" showSubtitle={true} />
          </div>

          {/* Hero Typography */}
          <div style={styles.heroTextSection}>
            <h1 style={styles.heroTitle}>
              Turn Your Meetings <br />
              <span style={styles.gradientHeadingText}>into Meaningful Insights</span>
            </h1>
            <p style={styles.heroSubtitle}>
              Upload audio or PDF, get AI-powered summaries, smart tags, and key insights — all in one place.
            </p>
          </div>

          {/* 4 Feature Pills */}
          <div style={styles.featureGrid}>
            <div style={styles.featurePill}>
              <div style={styles.featureIconWrap}>
                <FileText size={18} color="#6366F1" />
              </div>
              <span style={styles.featureLabel}>Summarize</span>
            </div>

            <div style={styles.featurePill}>
              <div style={styles.featureIconWrap}>
                <Mic size={18} color="#8B5CF6" />
              </div>
              <span style={styles.featureLabel}>Transcribe</span>
            </div>

            <div style={styles.featurePill}>
              <div style={styles.featureIconWrap}>
                <Tag size={18} color="#EC4899" />
              </div>
              <span style={styles.featureLabel}>Smart Tags</span>
            </div>

            <div style={styles.featurePill}>
              <div style={styles.featureIconWrap}>
                <BarChart3 size={18} color="#0EA5E9" />
              </div>
              <span style={styles.featureLabel}>Get Insights</span>
            </div>
          </div>

          {/* Graphical AI Showcase Card (Glassmorphic) */}
          <div style={styles.showcaseCard}>
            <div style={styles.showcaseCardInner}>
              {/* Mic & Waveform Header */}
              <div style={styles.showcaseHeader}>
                <div style={styles.micCircle}>
                  <Mic size={20} color="#6366F1" />
                </div>
                <div style={styles.soundWaveBars}>
                  <span style={{ ...styles.waveBar, height: '14px', animationDelay: '0s' }} />
                  <span style={{ ...styles.waveBar, height: '26px', animationDelay: '0.2s' }} />
                  <span style={{ ...styles.waveBar, height: '34px', animationDelay: '0.4s' }} />
                  <span style={{ ...styles.waveBar, height: '18px', animationDelay: '0.1s' }} />
                  <span style={{ ...styles.waveBar, height: '30px', animationDelay: '0.5s' }} />
                  <span style={{ ...styles.waveBar, height: '22px', animationDelay: '0.3s' }} />
                  <span style={{ ...styles.waveBar, height: '12px', animationDelay: '0.6s' }} />
                </div>

                <div style={styles.aiBadge}>
                  <Sparkles size={14} color="#FFFFFF" style={{ marginRight: '4px' }} />
                  <span>AI Powered</span>
                </div>
              </div>

              {/* Simulated text lines */}
              <div style={styles.simulatedTextWrap}>
                <div style={{ ...styles.simLine, width: '85%' }} />
                <div style={{ ...styles.simLine, width: '70%' }} />
                <div style={{ ...styles.simLine, width: '92%' }} />
                <div style={{ ...styles.simLine, width: '60%' }} />
              </div>

              {/* Floating Smart Tags */}
              <div style={styles.tagChipsWrap}>
                <span style={{ ...styles.tagChip, background: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' }}>
                  #Meeting
                </span>
                <span style={{ ...styles.tagChip, background: '#F5F3FF', color: '#7C3AED', borderColor: '#DDD6FE' }}>
                  #Project
                </span>
                <span style={{ ...styles.tagChip, background: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0' }}>
                  #Development
                </span>
                <span style={{ ...styles.tagChip, background: '#FDF2F8', color: '#DB2777', borderColor: '#FBCFE8' }}>
                  #AI
                </span>
              </div>
            </div>

            {/* Glowing bottom gradient wave accent */}
            <div style={styles.waveAccentGlow} />
          </div>

          {/* Bottom Footer Tagline */}
          <div style={styles.bottomTagline}>
            <span>Save Time</span>
            <span style={styles.bulletDot}>•</span>
            <span>Stay Organized</span>
            <span style={styles.bulletDot}>•</span>
            <span>Work Smarter</span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: AUTH CARD ================= */}
        <div style={styles.rightCol}>
          {/* Top Registration Redirect Link */}
          <div style={styles.topRightNav}>
            <span style={{ color: '#64748B', fontSize: '0.92rem', fontWeight: 500 }}>
              Don't have an account?{' '}
            </span>
            <Link to="/register" style={styles.registerLink}>
              Register
            </Link>
          </div>

          {/* Main Elevated White Glassmorphic Card */}
          <div style={styles.authCard}>
            {/* Centered Logo Badge */}
            <div style={styles.cardHeader}>
              <div style={styles.brandIconCircle}>
                <svg width="34" height="34" viewBox="0 0 54 54" fill="none">
                  <defs>
                    <linearGradient id="cardLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A855F7" />
                      <stop offset="45%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#38BDF8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M13 36 C13 26, 18 17, 23 24 C25.5 27.5, 27.5 32, 29 24 C33.5 16, 41 26, 41 36"
                    stroke="url(#cardLogoGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h2 style={styles.cardTitle}>Welcome Back</h2>
              <p style={styles.cardSubTitle}>Sign in to your MeetMind AI account</p>
            </div>

            {/* Feedback Notifications */}
            {error && (
              <div style={styles.errorAlert}>
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div style={styles.successAlert}>
                <CheckCircle2 size={18} style={{ marginRight: '8px' }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Email Field */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Email Address</label>
                <div style={styles.inputWrapper}>
                  <Mail size={18} color="#94A3B8" style={styles.inputIconLeft} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    style={styles.textInput}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={18} color="#94A3B8" style={styles.inputIconLeft} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={styles.textInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.iconButtonRight}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div style={styles.optionsRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.checkboxText}>Remember me</span>
                </label>

                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact administrator or reset password from backend.'); }} style={styles.forgotPassLink}>
                  Forgot password?
                </a>
              </div>

              {/* Gradient Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.75 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <ArrowRight size={19} style={{ marginRight: '8px' }} />
                    <span>Sign In</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={styles.dividerWrap}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>or continue with</span>
                <div style={styles.dividerLine} />
              </div>

              {/* Create Account Alternate Button */}
              <button
                type="button"
                onClick={() => navigate('/register')}
                style={styles.createAccountBtn}
              >
                <UserPlus size={18} color="#4F46E5" style={{ marginRight: '10px' }} />
                <span>Create a new account</span>
              </button>
            </form>

            {/* Terms and Privacy Footer */}
            <div style={styles.termsFooter}>
              By continuing, you agree to our{' '}
              <a href="#terms" style={styles.termsLink}>Terms of Service</a> •{' '}
              <a href="#privacy" style={styles.termsLink}>Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================= STYLES (Light Theme Precision Design) =================
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 45%, #EEF2FF 100%)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '40px 24px',
  },
  ambientBlobTopLeft: {
    position: 'absolute',
    top: '-120px',
    left: '-100px',
    width: '520px',
    height: '520px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.04) 70%, transparent 100%)',
    filter: 'blur(70px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  ambientBlobBottomRight: {
    position: 'absolute',
    bottom: '-120px',
    right: '-100px',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.05) 70%, transparent 100%)',
    filter: 'blur(80px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  layoutWrapper: {
    maxWidth: '1240px',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.95fr',
    gap: '56px',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },

  /* Left Hero */
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  logoHeader: {
    marginBottom: '8px',
  },
  heroTextSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  heroTitle: {
    fontSize: '2.85rem',
    fontWeight: 800,
    lineHeight: 1.18,
    color: '#0F172A',
    letterSpacing: '-0.035em',
  },
  gradientHeadingText: {
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.12rem',
    color: '#475569',
    lineHeight: 1.6,
    maxWidth: '520px',
  },

  /* Feature Pills */
  featureGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  featurePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '14px',
    padding: '10px 18px',
    boxShadow: '0 4px 14px -3px rgba(99, 102, 241, 0.07)',
    backdropFilter: 'blur(10px)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  featureIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#1E293B',
  },

  /* Showcase Preview Card */
  showcaseCard: {
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 20px 45px -10px rgba(99, 102, 241, 0.12), 0 0 1px 1px rgba(226, 232, 240, 0.6)',
    backdropFilter: 'blur(20px)',
    maxWidth: '510px',
    overflow: 'hidden',
  },
  showcaseCardInner: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  showcaseHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  micCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#EEF2FF',
    border: '1px solid #E0E7FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundWaveBars: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  waveBar: {
    width: '3px',
    background: 'linear-gradient(180deg, #8B5CF6, #6366F1)',
    borderRadius: '2px',
    display: 'inline-block',
  },
  aiBadge: {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    color: '#FFFFFF',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: '20px',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
  },
  simulatedTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(248, 250, 252, 0.7)',
    padding: '14px',
    borderRadius: '12px',
    border: '1px dashed #E2E8F0',
  },
  simLine: {
    height: '8px',
    background: '#E2E8F0',
    borderRadius: '4px',
  },
  tagChipsWrap: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tagChip: {
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '5px 12px',
    borderRadius: '8px',
    border: '1px solid transparent',
  },
  waveAccentGlow: {
    position: 'absolute',
    bottom: '-50px',
    left: '-20px',
    right: '-20px',
    height: '110px',
    background: 'radial-gradient(ellipse at bottom, rgba(99, 102, 241, 0.22) 0%, rgba(139, 92, 246, 0.15) 50%, transparent 80%)',
    filter: 'blur(30px)',
    pointerEvents: 'none',
  },
  bottomTagline: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#64748B',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  bulletDot: {
    color: '#CBD5E1',
  },

  /* Right Col (Auth Card) */
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'flex-end',
  },
  topRightNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingRight: '6px',
  },
  registerLink: {
    color: '#4F46E5',
    fontWeight: 700,
    fontSize: '0.92rem',
    textDecoration: 'none',
  },
  authCard: {
    width: '100%',
    maxWidth: '470px',
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    borderRadius: '28px',
    padding: '40px 36px',
    boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '26px',
  },
  brandIconCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
    border: '1px solid #E0E7FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.18)',
  },
  cardTitle: {
    fontSize: '1.9rem',
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: '-0.03em',
    marginBottom: '6px',
  },
  cardSubTitle: {
    fontSize: '0.95rem',
    color: '#64748B',
    fontWeight: 500,
  },

  /* Form */
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputLabel: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#1E293B',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIconLeft: {
    position: 'absolute',
    left: '14px',
    pointerEvents: 'none',
  },
  iconButtonRight: {
    position: 'absolute',
    right: '12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
  },
  textInput: {
    width: '100%',
    padding: '13px 40px 13px 42px',
    fontSize: '0.94rem',
    color: '#0F172A',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-body)',
  },
  optionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.86rem',
    marginTop: '2px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#6366F1',
    cursor: 'pointer',
  },
  checkboxText: {
    color: '#475569',
    fontWeight: 500,
  },
  forgotPassLink: {
    color: '#4F46E5',
    fontWeight: 600,
    fontSize: '0.86rem',
    textDecoration: 'none',
  },

  /* Buttons */
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #3B82F6 100%)',
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: 700,
    border: 'none',
    borderRadius: '14px',
    boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.45)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    marginTop: '6px',
  },
  dividerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    margin: '6px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#E2E8F0',
  },
  dividerText: {
    fontSize: '0.8rem',
    color: '#94A3B8',
    fontWeight: 500,
    textTransform: 'lowercase',
  },
  createAccountBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '13px',
    background: '#FFFFFF',
    border: '1.5px solid #E0E7FF',
    borderRadius: '14px',
    color: '#3730A3',
    fontSize: '0.94rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  termsFooter: {
    marginTop: '22px',
    textAlign: 'center',
    fontSize: '0.78rem',
    color: '#94A3B8',
    lineHeight: 1.5,
  },
  termsLink: {
    color: '#64748B',
    textDecoration: 'underline',
  },
  errorAlert: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '0.88rem',
    fontWeight: 500,
    marginBottom: '16px',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#16A34A',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '0.88rem',
    fontWeight: 500,
    marginBottom: '16px',
  },
};
