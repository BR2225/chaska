import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.role === "admin") {
        toast.success("Welcome back, Admin!");
        navigate("/admin/dashboard");
      } else {
        toast.error("Admin access required");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(" ") : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F0E6] px-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="https://customer-assets.emergentagent.com/job_italian-desserts-co/artifacts/776xxbkt_shared%20image.jpeg" alt="Chaska" className="h-16 w-auto mx-auto mb-3 rounded-xl" />
          <h1 className="font-['Boogaloo'] text-4xl text-[#2C241B] tracking-wide">CHASKA</h1>
          <p className="text-sm text-[#5C5042] mt-1">Admin Dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(44,36,27,0.08)] border border-[#E3DCD2]/50" data-testid="admin-login-form">
          <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Sign In</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#2C241B]">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 border-[#E3DCD2]" data-testid="admin-email-input" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2C241B]">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 border-[#E3DCD2]" data-testid="admin-password-input" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-11 font-medium" data-testid="admin-login-btn">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
