import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#2C241B] text-[#FDFBF7]" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <h3 className="font-['Cormorant_Garamond'] text-3xl font-semibold text-[#FDFBF7] mb-4">
              Chas<span className="text-[#D96C4A]">ka</span>
            </h3>
            <p className="text-[#E3DCD2]/80 leading-relaxed text-sm">
              Authentic Italian bomboloni and tiramisu, crafted with love using traditional recipes passed down through generations.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2">
            <h4 className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-4 font-medium">Explore</h4>
            <div className="space-y-2">
              {[{ to: "/", label: "Home" }, { to: "/menu", label: "Menu" }, { to: "/contact", label: "Contact" }].map(l => (
                <Link key={l.to} to={l.to} className="block text-sm text-[#E3DCD2]/80 hover:text-[#D96C4A] transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div className="md:col-span-3">
            <h4 className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-4 font-medium">Visit Us</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-[#E3DCD2]/80">
                <MapPin className="w-4 h-4 mt-0.5 text-[#D96C4A]" strokeWidth={1.5} />
                <span>42 Via Roma, Connaught Place, New Delhi</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#E3DCD2]/80">
                <Phone className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#E3DCD2]/80">
                <Mail className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                <span>hello@chaska.in</span>
              </div>
            </div>
          </div>

          {/* Hours */}
          <div className="md:col-span-3">
            <h4 className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-4 font-medium">Hours</h4>
            <div className="space-y-2 text-sm text-[#E3DCD2]/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                <span>Mon - Fri: 8AM - 10PM</span>
              </div>
              <p className="pl-6">Sat - Sun: 9AM - 11PM</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#FDFBF7]/10 mt-12 pt-8 text-center">
          <p className="text-xs text-[#E3DCD2]/50 tracking-wider">
            &copy; {new Date().getFullYear()} Chaska. All rights reserved. Crafted with amore.
          </p>
        </div>
      </div>
    </footer>
  );
}
