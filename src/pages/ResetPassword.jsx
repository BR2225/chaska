import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Eye, EyeOff, X } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const rules = [
    [password.length >= 8, "8+ characters"],
    [/\p{L}/u.test(password), "One letter"],
    [/\d/.test(password), "One number"],
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Both passwords must match");
      return;
    }
    if (!rules.every(([valid]) => valid)) {
      toast.error("Password must be at least 8 characters and include a letter and number");
      return;
    }
    setLoading(true);
    try {
      await http.post("/api/auth/reset-password", { token, password });
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map(e => e.msg).join(" ")
          : err.request
            ? "Cannot reach the Chaska server. Please try again."
            : "Could not reset your password";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-[#FDFBF7] px-6" data-testid="reset-password-page">
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
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(44,36,27,0.08)] border border-[#E3DCD2]/50">
          <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-2">Choose a new password</h2>

          {!token ? (
            <div data-testid="reset-password-missing-token">
              <p className="text-sm text-[#5C5042] mt-2">
                This link is missing its reset code. Request a new one and use the most recent email.
              </p>
              <Link to="/forgot-password" className="inline-block mt-6 text-sm text-[#D96C4A] font-medium hover:underline">
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#5C5042] mb-6">
                Signing in again everywhere will be required after this change.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-form">
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">New password</Label>
                  <div className="relative mt-1">
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className="border-[#E3DCD2] pr-11"
                      placeholder="At least 8 characters"
                      data-testid="reset-password-input"
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
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs" aria-live="polite">
                    {rules.map(([valid, label]) => (
                      <span key={label} className={`flex items-center gap-1 ${valid ? "text-[#4A7c59]" : "text-[#7A6F63]"}`}>
                        {valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">Confirm new password</Label>
                  <Input
                    name="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    maxLength={128}
                    autoComplete="new-password"
                    className="mt-1 border-[#E3DCD2]"
                    placeholder="Repeat your new password"
                    data-testid="reset-confirm-input"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-11 font-medium" data-testid="reset-submit-btn">
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
