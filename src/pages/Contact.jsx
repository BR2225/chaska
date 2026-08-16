import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import http from "@/lib/http";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL as API } from "@/config/api";

export default function Contact() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    setForm(current => ({
      ...current,
      name: current.name || user.name || "",
      email: current.email || user.email || "",
    }));
  }, [user]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      await http.post(`${API}/api/contact`, form);
      setSent(true);
      toast.success("Message sent successfully!");
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Please sign in to contact us.");
        navigate("/login", { state: { from: location, reason: "contact" }, replace: true });
      } else if (error.response?.status === 429) {
        toast.error("Too many messages. Please try again later.");
      } else {
        toast.error("Failed to send message");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 sm:pt-28 pb-16" data-testid="contact-page">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Get in Touch</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-12">
          Contact Us
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Info */}
          <div className="lg:col-span-5 space-y-8">
            <div
              className="relative h-[250px] rounded-2xl overflow-hidden"
              style={{ backgroundImage: `url(https://images.unsplash.com/photo-1774758951271-e0886de596f7?w=800)`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="absolute inset-0 bg-[#2C241B]/40" />
              <div className="relative z-10 flex items-end h-full p-6">
                <h3 className="font-['Cormorant_Garamond'] text-3xl text-[#FDFBF7] font-medium">Visit Our Store</h3>
              </div>
            </div>

            <div className="space-y-5">
              {[
                { icon: MapPin, label: "Address", value: "42 Via Roma, Connaught Place, New Delhi 110001" },
                { icon: Phone, label: "Phone", value: "+91 98765 43210" },
                { icon: Mail, label: "Email", value: "hello@chaska.in" },
                { icon: Clock, label: "Hours", value: "Mon-Fri 8AM-10PM | Sat-Sun 9AM-11PM" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#D96C4A]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042] mb-0.5">{label}</p>
                    <p className="text-sm text-[#2C241B]">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7">
            {sent ? (
              <div className="bg-white rounded-2xl p-8 sm:p-12 border border-[#E3DCD2]/50 shadow-sm text-center" data-testid="contact-success">
                <div className="w-16 h-16 bg-[#4A7c59] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-7 h-7 text-white" />
                </div>
                <h2 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B] mb-3">Message Sent!</h2>
                <p className="text-[#5C5042]">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm" data-testid="contact-form">
                <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Send a Message</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-[#2C241B]">Name *</Label>
                      <Input name="name" value={form.name} onChange={handleChange} required className="mt-1 border-[#E3DCD2]" data-testid="contact-name" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[#2C241B]">Email *</Label>
                      <Input name="email" type="email" value={form.email} onChange={handleChange} required className="mt-1 border-[#E3DCD2]" data-testid="contact-email" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[#2C241B]">Subject</Label>
                    <Input name="subject" value={form.subject} onChange={handleChange} className="mt-1 border-[#E3DCD2]" data-testid="contact-subject" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[#2C241B]">Message *</Label>
                    <Textarea name="message" value={form.message} onChange={handleChange} required rows={5} className="mt-1 border-[#E3DCD2]" data-testid="contact-message" />
                  </div>
                  <Button type="submit" disabled={loading} className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-8 py-3 h-auto font-medium" data-testid="contact-submit">
                    {loading ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
