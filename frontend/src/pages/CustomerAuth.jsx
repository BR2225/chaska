import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Eye, EyeOff, X } from "lucide-react";

export default function CustomerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ full_name: "", identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requestedLocation = location.state?.from;
  const authReason = location.state?.reason;
  const requestedPath = requestedLocation?.pathname?.startsWith("/")
    ? `${requestedLocation.pathname}${requestedLocation.search || ""}`
    : "/";

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const account = await login(form.identifier, form.password);
        toast.success("Welcome back!");
        navigate(account.role === "customer" ? requestedPath : "/admin/dashboard", { replace: true });
      } else {
        const fullName = form.full_name.trim();
        if (fullName.length < 2) { toast.error("Enter your full name"); return; }
        if (form.password.length < 8 || !/\p{L}/u.test(form.password) || !/\d/.test(form.password)) {
          toast.error("Password must be at least 8 characters and include a letter and number");
          return;
        }
        await register(fullName, form.identifier, form.password);
        toast.success("Account created successfully!");
        navigate(requestedPath, { replace: true });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map(e => e.msg).join(" ")
          : err.request
            ? "Cannot reach the Chaska server. Please try again."
            : isLogin ? "Invalid email/phone or password" : "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-[#FDFBF7] px-6" data-testid="customer-auth-page">
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
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${isLogin ? "bg-white text-[#2C241B] shadow-sm" : "text-[#5C5042]"}`}
              data-testid="tab-login"
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
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
              <Input name="identifier" type="text" value={form.identifier} onChange={handleChange} required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} className="mt-1 border-[#E3DCD2]" placeholder="you@example.com or 9876543210" data-testid="auth-identifier-input" />
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
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-xs text-[#5C5042] mt-4">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-[#D96C4A] font-medium hover:underline" data-testid="auth-toggle">
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
