import { Link } from "react-router-dom";
import { MapPin, Phone, Clock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#2C241B] text-[#FDFBF7]" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/chaska-mark.png"
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-14 w-auto shrink-0 object-contain"
              />
              <div>
                <h3 className="font-['Boogaloo'] text-3xl text-[#FDFBF7] tracking-wide leading-none">CHASKA</h3>
                <span className="text-[9px] uppercase tracking-[0.15em] text-[#E3DCD2]/70">Handmade Bliss on Your Way</span>
              </div>
            </div>
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
                <span>Infront of KFC, Chandaka Industrial Estate, Patia, Bhubaneswar, Odisha 751024</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#E3DCD2]/80">
                <Phone className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                <a href="tel:+916371845506" className="hover:text-[#D96C4A] transition-colors">+91 63718 45506</a>
              </div>
            </div>
          </div>

          {/* Hours */}
          <div className="md:col-span-3">
            <h4 className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-4 font-medium">Hours</h4>
            <div className="space-y-2 text-sm text-[#E3DCD2]/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
                <span>Mon - Sun: 5:30PM - 8PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lazy so the map is fetched when a visitor scrolls to it rather than
            competing with the menu for the first load. */}
        <div className="mt-12">
          <h4 className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-4 font-medium">Find Us</h4>
          <div className="overflow-hidden rounded-2xl border border-[#FDFBF7]/10">
            <iframe
              title="Map showing Chaska in Patia, Bhubaneswar"
              src="https://maps.google.com/maps?q=20.3537483,85.8174694&z=16&output=embed"
              className="block w-full h-64 sm:h-80 border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href="https://maps.google.com/?cid=3277831621940547587"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-[#D96C4A] hover:underline"
          >
            Open in Google Maps
          </a>
        </div>

        <div className="border-t border-[#FDFBF7]/10 mt-12 pt-8 text-center">
          <p className="text-xs text-[#E3DCD2]/50 tracking-wider">
            &copy; {new Date().getFullYear()} Chaska. All rights reserved. Handmade bliss on your way.
          </p>
        </div>
      </div>
    </footer>
  );
}
