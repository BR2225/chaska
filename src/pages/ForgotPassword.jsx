import { useState } from "react";
import { Link } from "react-router-dom";
import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await http.post("/api/auth/forgot-password", { identifier });
      setSent(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map(e => e.msg).join(" ")
          : err.request
            ? "Cannot reach the Chaska server. Please try again."
            : "Could not send the reset link";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-[#FDFBF7] px-6" data-testid="forgot-password-page">
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
          {sent ? (
            <div className="text-center" data-testid="forgot-password-sent">
              <MailCheck className="w-10 h-10 mx-auto text-[#4A7c59]" strokeWidth={1.5} />
              <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mt-4">Check your email</h2>
              <p className="text-sm text-[#5C5042] mt-2">
                If an account exists for that email, we have sent a link to reset your password. It expires in 30 minutes.
              </p>
              <p className="text-xs text-[#5C5042] mt-4">
                Reset links can only be sent to accounts registered with an email address.
              </p>
              <Link to="/login" className="inline-block mt-6 text-sm text-[#D96C4A] font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-2">Forgot password</h2>
              <p className="text-sm text-[#5C5042] mb-6">
                Enter the email or phone number on your account and we will send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-password-form">
                <div>
                  <Label className="text-sm font-medium text-[#2C241B]">Email or phone number</Label>
                  <Input
                    name="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    maxLength={254}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="mt-1 border-[#E3DCD2]"
                    placeholder="you@example.com or 9876543210"
                    data-testid="forgot-identifier-input"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-11 font-medium" data-testid="forgot-submit-btn">
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
              <p className="text-center text-xs text-[#5C5042] mt-4">
                Remembered it?{" "}
                <Link to="/login" className="text-[#D96C4A] font-medium hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
