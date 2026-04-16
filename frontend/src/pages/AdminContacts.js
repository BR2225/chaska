import { useState, useEffect } from "react";
import axios from "axios";
import { Mail, MailOpen } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminContacts() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/admin/contacts`, { withCredentials: true }).then(r => setContacts(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="admin-contacts-page">
      <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B] mb-8">Messages</h1>
      <div className="space-y-4">
        {contacts.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E3DCD2] p-12 text-center">
            <p className="text-[#5C5042]">No messages yet</p>
          </div>
        ) : contacts.map(c => (
          <div key={c.id} className="bg-white rounded-lg border border-[#E3DCD2] shadow-sm p-5" data-testid={`contact-card-${c.id}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${c.read ? "bg-[#E3DCD2]/50" : "bg-[#D96C4A]/10"}`}>
                {c.read ? <MailOpen className="w-4 h-4 text-[#5C5042]" strokeWidth={1.5} /> : <Mail className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-[#2C241B]">{c.name}</p>
                  <span className="text-xs text-[#5C5042]">{c.created_at && new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-[#5C5042] mb-1">{c.email}</p>
                {c.subject && <p className="text-sm font-medium text-[#2C241B] mb-1">{c.subject}</p>}
                <p className="text-sm text-[#5C5042] leading-relaxed">{c.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
