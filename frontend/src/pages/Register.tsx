import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  LogIn, 
  ShieldCheck, 
  Zap, 
  Sparkles,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { authApi } from '../api/auth';

export const Register: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (!agreeTerms) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.register(name.trim(), email.trim(), password, confirmPassword);

      // Store JWT token in localStorage as localStorage.setItem("token", access_token)
      const access_token = res.access_token || res.token;
      if (access_token) {
        const cleanToken = typeof access_token === 'string'
          ? access_token.trim().replace(/^["']|["']$/g, '')
          : String(access_token);
        localStorage.setItem("token", cleanToken);
      }

      setSuccessMsg(res.welcome_message || `Account created successfully! Welcome, ${name}!`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Registration failed. Email may already be registered.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.ambientBlobTopLeft} />
      <div style={styles.ambientBlobBottomRight} />

      <div style={styles.layoutWrapper}>
        {/* ================= LEFT COLUMN: HERO SHOWCASE ================= */}
        <div style={styles.leftCol}>
          <div style={styles.logoHeader}>
            <Logo size="md" showSubtitle={true} />
          </div>

          <div style={styles.heroTextSection}>
            <h1 style={styles.heroTitle}>
              Join the Future of <br />
              <span style={styles.gradientHeadingText}>Meeting Intelligence</span>
            </h1>
            <p style={styles.heroSubtitle}>
              Create your account to unlock automated audio transcription, multi-category meeting classification, and AI action tracking.
            </p>
          </div>

          {/* Benefits Grid */}
          <div style={styles.benefitGrid}>
            <div style={styles.benefitCard}>
              <div style={styles.benefitIconWrap}>
                <Zap size={20} color="#6366F1" />
              </div>
              <div>
                <h4 style={styles.benefitTitle}>AI Audio Transcription</h4>
                <p style={styles.benefitDesc}>Transcribe meetings in seconds with state-of-the-art accuracy.</p>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <div style={styles.benefitIconWrap}>
                <Cpu size={20} color="#8B5CF6" />
              </div>
              <div>
                <h4 style={styles.benefitTitle}>ML Category Classifier</h4>
                <p style={styles.benefitDesc}>Categorize into Technical, Client, Project Review, and more.</p>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <div style={styles.benefitIconWrap}>
                <ShieldCheck size={20} color="#10B981" />
              </div>
              <div>
                <h4 style={styles.benefitTitle}>Enterprise Security</h4>
                <p style={styles.benefitDesc}>End-to-end encrypted storage powered by Meeting Intelligence.</p>
              </div>
            </div>
          </div>

          <div style={styles.bottomTagline}>
            <span>Fast Setup</span>
            <span style={styles.bulletDot}>•</span>
            <span>No Credit Card Required</span>
            <span style={styles.bulletDot}>•</span>
            <span>Full AI Access</span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: REGISTRATION CARD ================= */}
        <div style={styles.rightCol}>
          <div style={styles.topRightNav}>
            <span style={{ color: '#64748B', fontSize: '0.92rem', fontWeight: 500 }}>
              Already have an account?{' '}
            </span>
            <Link to="/" style={styles.loginLink}>
              Sign In
            </Link>
          </div>

          <div style={styles.authCard}>
            <div style={styles.cardHeader}>
              <div style={styles.brandIconCircle}>
                <Sparkles size={28} color="#6366F1" />
              </div>

              <h2 style={styles.cardTitle}>Create Account</h2>
              <p style={styles.cardSubTitle}>Start organizing your meetings with MeetMind AI</p>
            </div>

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

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Full Name */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Full Name</label>
                <div style={styles.inputWrapper}>
                  <User size={18} color="#94A3B8" style={styles.inputIconLeft} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    style={styles.textInput}
                  />
                </div>
              </div>

              {/* Email */}
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

              {/* Password */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Password (minimum 8 characters)</label>
                <div style={styles.inputWrapper}>
                  <Lock size={18} color="#94A3B8" style={styles.inputIconLeft} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
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

              {/* Confirm Password */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Confirm Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={18} color="#94A3B8" style={styles.inputIconLeft} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    style={styles.textInput}
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={styles.checkboxText}>
                  I agree to the <a href="#terms" style={styles.linkInline}>Terms of Service</a> & <a href="#privacy" style={styles.linkInline}>Privacy Policy</a>
                </span>
              </label>

              {/* Register Button */}
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
                  <span>Creating account...</span>
                ) : (
                  <>
                    <ArrowRight size={19} style={{ marginRight: '8px' }} />
                    <span>Create Account</span>
                  </>
                )}
              </button>

              <div style={styles.dividerWrap}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>or</span>
                <div style={styles.dividerLine} />
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                style={styles.loginAltBtn}
              >
                <LogIn size={18} color="#4F46E5" style={{ marginRight: '10px' }} />
                <span>Sign In to existing account</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  benefitGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '510px',
  },
  benefitCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    background: 'rgba(255, 255, 255, 0.82)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '18px',
    padding: '16px 20px',
    boxShadow: '0 4px 16px -4px rgba(99, 102, 241, 0.07)',
    backdropFilter: 'blur(10px)',
  },
  benefitIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1E293B',
    marginBottom: '4px',
  },
  benefitDesc: {
    fontSize: '0.88rem',
    color: '#64748B',
    lineHeight: 1.45,
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
  loginLink: {
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
    padding: '36px 36px',
    boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.14)',
    backdropFilter: 'blur(20px)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '22px',
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
    marginBottom: '14px',
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
    fontSize: '0.92rem',
    color: '#64748B',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '0.86rem',
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
    padding: '12px 38px 12px 42px',
    fontSize: '0.92rem',
    color: '#0F172A',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-body)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '0.82rem',
    color: '#475569',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#6366F1',
    cursor: 'pointer',
  },
  checkboxText: {
    lineHeight: 1.4,
  },
  linkInline: {
    color: '#4F46E5',
    textDecoration: 'underline',
  },
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
    transition: 'all 0.15s ease',
    marginTop: '6px',
  },
  dividerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    margin: '4px 0',
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
  },
  loginAltBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px',
    background: '#FFFFFF',
    border: '1.5px solid #E0E7FF',
    borderRadius: '14px',
    color: '#3730A3',
    fontSize: '0.92rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorAlert: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '0.88rem',
    fontWeight: 500,
    marginBottom: '14px',
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
    marginBottom: '14px',
  },
};
