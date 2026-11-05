import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, EyeOff, X } from "lucide-react";

// The server reports validation failures as a list of objects, so the detail
// cannot go to the toast as it arrives.
function describeError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(entry => entry.msg).join(" ");
  if (err.request) return "Cannot reach the Chaska server. Please try again.";
  return fallback;
}

export default function CustomerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ full_name: "", identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Either the details or the code is on screen, never both.
  const [step, setStep] = useState("details");
  // Which flow the code belongs to: finishing a registration, or signing in
  // without a password.
  const [codeFlow, setCodeFlow] = useState("register");
  const [channel, setChannel] = useState("email");
  const [code, setCode] = useState("");
  // Which ways of signing up actually work today. Null until we know, so the
  // form never rules a channel out on the strength of a guess.
  const [channels, setChannels] = useState(null);
  const {
    login, startRegistration, completeRegistration, requestLoginOtp, loginWithOtp,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    http.get("/api/auth/channels")
      .then(({ data }) => { if (active) setChannels(data); })
      .catch(() => { /* the form still works; the server says if it cannot send */ });
    return () => { active = false; };
  }, []);

  const emailOnly = channels !== null && channels.email && !channels.phone;
  const phoneOnly = channels !== null && channels.phone && !channels.email;

  const requestedLocation = location.state?.from;
  const authReason = location.state?.reason;
  const requestedPath = requestedLocation?.pathname?.startsWith("/")
    ? `${requestedLocation.pathname}${requestedLocation.search || ""}`
    : "/";

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const goHome = (account) => {
    navigate(account.role === "customer" ? requestedPath : "/admin/dashboard", { replace: true });
  };

  const switchMode = (toLogin) => {
    setIsLogin(toLogin);
    setStep("details");
    setCode("");
  };

  const sendCode = async () => {
    if (codeFlow === "login") {
      const { identity_type } = await requestLoginOtp(form.identifier);
      setChannel(identity_type);
      return;
    }
    const { identity_type } = await startRegistration(
      form.full_name.trim(), form.identifier, form.password,
    );
    setChannel(identity_type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const account = await login(form.identifier, form.password);
        toast.success("Welcome back!");
        goHome(account);
        return;
      }
      const fullName = form.full_name.trim();
      if (fullName.length < 2) { toast.error("Enter your full name"); return; }
      if (form.password.length < 8 || !/\p{L}/u.test(form.password) || !/\d/.test(form.password)) {
        toast.error("Password must be at least 8 characters and include a letter and number");
        return;
      }
      setCodeFlow("register");
      const { identity_type } = await startRegistration(fullName, form.identifier, form.password);
      setChannel(identity_type);
      setStep("code");
      toast.success(`We sent a 6-digit code to your ${identity_type}.`);
    } catch (err) {
      toast.error(describeError(err, isLogin ? "Invalid email/phone or password" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendLoginCode = async () => {
    if (!form.identifier.trim()) {
      toast.error("Enter your email or phone number first");
      return;
    }
    setLoading(true);
    try {
      setCodeFlow("login");
      const { identity_type, message } = await requestLoginOtp(form.identifier);
      setChannel(identity_type);
      setStep("code");
      toast.success(message);
    } catch (err) {
      toast.error(describeError(err, "Could not send a code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const account = codeFlow === "register"
        ? await completeRegistration(form.identifier, code)
        : await loginWithOtp(form.identifier, code);
      toast.success(codeFlow === "register" ? "Account created. Welcome to Chaska!" : "Welcome back!");
      goHome(account);
    } catch (err) {
      toast.error(describeError(err, "That code did not work. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendCode();
      setCode("");
      toast.success("A new code is on its way. The previous one no longer works.");
    } catch (err) {
      toast.error(describeError(err, "Could not send another code just yet."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-[#FDF0DB] px-6" data-testid="customer-auth-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/">
            <img
              src="/chaska-mark.png"
              alt=""
              aria-hidden="true"
              className="h-20 sm:h-24 w-auto mx-auto mb-3 object-contain"
            />
          </Link>
          <h1 className="font-['Boogaloo'] text-3xl text-[#2C241B] tracking-wide">CHASKA</h1>
          <p className="text-xs text-[#5C5042] mt-1 uppercase tracking-[0.15em]">Handmade Bliss on Your Way</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(44,36,27,0.08)] border border-[#E3DCD2]/50" data-testid="auth-form">
          {step === "code" ? (
            <div data-testid="auth-code-step">
              <button
                type="button"
                onClick={() => { setStep("details"); setCode(""); }}
                className="flex items-center gap-1 text-sm text-[#5C5042] hover:text-[#2C241B] mb-5"
                data-testid="auth-code-back"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-2">
                Enter your code
              </h2>
              <p className="text-sm text-[#5C5042] mb-6">
                We sent a 6-digit code to the {channel === "phone" ? "number" : "address"}{" "}
                <span className="text-[#2C241B] font-medium">{form.identifier}</span>. It expires in 10 minutes.
              </p>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">6-digit code</Label>
                  <Input
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="mt-1 border-[#E3DCD2] text-center text-2xl tracking-[0.5em] font-medium"
                    placeholder="000000"
                    data-testid="auth-code-input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-11 font-medium"
                  data-testid="auth-code-submit"
                >
                  {loading ? "Please wait..." : codeFlow === "register" ? "Create Account" : "Sign In"}
                </Button>
              </form>

              <p className="text-center text-xs text-[#5C5042] mt-4">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-[#D96C4A] font-medium hover:underline disabled:opacity-50"
                  data-testid="auth-code-resend"
                >
                  Send another
                </button>
              </p>
            </div>
          ) : (
            <>
              {requestedLocation && (
                <div className="mb-5 rounded-xl border border-[#D96C4A]/20 bg-[#D96C4A]/[0.06] px-4 py-3 text-center text-sm text-[#5C5042]" role="status">
                  {authReason === "cart"
                    ? "Sign in or create an account to use your cart."
                    : authReason === "contact"
                      ? "Sign in or create an account to contact us."
                      : requestedPath === "/checkout"
                        ? "Sign in or create an account to place your order."
                        : "Sign in or create an account to continue."}
                </div>
              )}
              {/* Toggle */}
              <div className="flex mb-6 bg-[#F4F0E6] rounded-full p-1">
                <button
                  onClick={() => switchMode(true)}
                  className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${isLogin ? "bg-white text-[#2C241B] shadow-sm" : "text-[#5C5042]"}`}
                  data-testid="tab-login"
                >
                  Sign In
                </button>
                <button
                  onClick={() => switchMode(false)}
                  className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${!isLogin ? "bg-white text-[#2C241B] shadow-sm" : "text-[#5C5042]"}`}
                  data-testid="tab-register"
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <Label className="text-sm font-medium text-[#2C241B]">Full Name</Label>
                    <Input name="full_name" value={form.full_name} onChange={handleChange} required={!isLogin} minLength={2} maxLength={120} autoComplete="name" className="mt-1 border-[#E3DCD2]" placeholder="Your full name" data-testid="auth-name-input" />
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">Email or phone number</Label>
                  <Input
                    name="identifier"
                    type="text"
                    value={form.identifier}
                    onChange={handleChange}
                    required
                    maxLength={254}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="mt-1 border-[#E3DCD2]"
                    placeholder={emailOnly ? "you@example.com" : phoneOnly ? "9876543210" : "you@example.com or 9876543210"}
                    data-testid="auth-identifier-input"
                  />
                  {!isLogin && (
                    <p className="mt-1.5 text-xs text-[#5C5042]" data-testid="auth-identifier-hint">
                      {emailOnly
                        ? "We can only send codes by email at the moment, so please use an email address."
                        : phoneOnly
                          ? "We can only send codes by SMS at the moment, so please use a phone number."
                          : "We'll send a 6-digit code here to confirm it's yours."}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      required
                      minLength={isLogin ? undefined : 8}
                      maxLength={128}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className="border-[#E3DCD2] pr-11"
                      placeholder={isLogin ? "Your password" : "At least 8 characters"}
                      data-testid="auth-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute inset-y-0 right-0 px-3 text-[#5C5042] hover:text-[#2C241B]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isLogin && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs" aria-live="polite">
                      {[
                        [form.password.length >= 8, "8+ characters"],
                        [/\p{L}/u.test(form.password), "One letter"],
                        [/\d/.test(form.password), "One number"],
                      ].map(([valid, label]) => (
                        <span key={label} className={`flex items-center gap-1 ${valid ? "text-[#4A7c59]" : "text-[#7A6F63]"}`}>
                          {valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-11 font-medium" data-testid="auth-submit-btn">
                  {loading ? "Please wait..." : isLogin ? "Sign In" : "Continue"}
                </Button>
              </form>

              {isLogin && (
                <>
                  <div className="flex items-center gap-3 my-4" aria-hidden="true">
                    <span className="h-px flex-1 bg-[#E3DCD2]" />
                    <span className="text-xs text-[#7A6F63] uppercase tracking-[0.15em]">or</span>
                    <span className="h-px flex-1 bg-[#E3DCD2]" />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendLoginCode}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-[#E3DCD2] text-[#2C241B] hover:bg-[#F4F0E6] rounded-full h-11 font-medium"
                    data-testid="auth-otp-login-btn"
                  >
                    Email or text me a code instead
                  </Button>
                  <p className="text-center text-xs text-[#5C5042] mt-4">
                    <Link to="/forgot-password" className="text-[#D96C4A] font-medium hover:underline" data-testid="auth-forgot-link">
                      Forgot your password?
                    </Link>
                  </p>
                </>
              )}

              <p className="text-center text-xs text-[#5C5042] mt-4">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => switchMode(!isLogin)} className="text-[#D96C4A] font-medium hover:underline" data-testid="auth-toggle">
                  {isLogin ? "Register" : "Sign In"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
