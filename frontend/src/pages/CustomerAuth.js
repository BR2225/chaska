import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CustomerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        toast.success("Welcome back!");
        navigate("/");
      } else {
        if (!form.name) { toast.error("Name is required"); setLoading(false); return; }
        await axios.post(`${API}/api/auth/register`, { name: form.name, email: form.email, password: form.password }, { withCredentials: true });
        await login(form.email, form.password);
        toast.success("Account created successfully!");
        navigate("/");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(" ") : isLogin ? "Invalid email or password" : "Registration failed";
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
            <img src="https://customer-assets.emergentagent.com/job_italian-desserts-co/artifacts/776xxbkt_shared%20image.jpeg" alt="Chaska" className="h-16 w-auto mx-auto mb-3 rounded-xl" />
          </Link>
          <h1 className="font-['Boogaloo'] text-3xl text-[#2C241B] tracking-wide">CHASKA</h1>
          <p className="text-xs text-[#5C5042] mt-1 uppercase tracking-[0.15em]">Handmade Bliss on Your Way</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(44,36,27,0.08)] border border-[#E3DCD2]/50" data-testid="auth-form">
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
                <Input name="name" value={form.name} onChange={handleChange} required={!isLogin} className="mt-1 border-[#E3DCD2]" placeholder="Your name" data-testid="auth-name-input" />
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-[#2C241B]">Email</Label>
              <Input name="email" type="email" value={form.email} onChange={handleChange} required className="mt-1 border-[#E3DCD2]" placeholder="you@example.com" data-testid="auth-email-input" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2C241B]">Password</Label>
              <Input name="password" type="password" value={form.password} onChange={handleChange} required className="mt-1 border-[#E3DCD2]" placeholder="Min 6 characters" data-testid="auth-password-input" />
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
