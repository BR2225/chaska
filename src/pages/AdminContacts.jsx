import { useState, useEffect } from "react";
import http from "@/lib/http";
import { Mail, MailOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";

export default function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    http.get(`${API}/api/admin/contacts`).then(r => setContacts(r.data)).catch(() => {});
  }, []);

  const markRead = async (contactId) => {
    try {
      await http.patch(`${API}/api/admin/contacts/${contactId}/read`);
      setContacts(current => current.map(contact => contact.id === contactId ? { ...contact, read: true } : contact));
    } catch {
      toast.error("Could not mark this message as read");
    }
  };

  const openReply = (contactId) => { setReplyingTo(contactId); setDraft(""); };

  const sendReply = async (contact) => {
    setSending(true);
    try {
      const { data } = await http.post(`${API}/api/admin/contacts/${contact.id}/reply`, { message: draft });
      setContacts(current => current.map(c => c.id === contact.id ? { ...c, read: true, replies: [...(c.replies || []), data.reply] } : c));
      setReplyingTo(null);
      toast.success(`Reply sent to ${contact.email}`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

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
                <p className="text-sm text-[#5C5042] leading-relaxed whitespace-pre-wrap">{c.message}</p>

                {c.replies?.map((reply, idx) => (
                  <div key={idx} className="mt-3 bg-[#F4F0E6] rounded-lg p-3" data-testid={`contact-reply-${c.id}-${idx}`}>
                    <p className="text-xs text-[#5C5042] mb-1">You replied{reply.sent_at && ` on ${new Date(reply.sent_at).toLocaleString()}`}</p>
                    <p className="text-sm text-[#2C241B] leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))}

                {replyingTo === c.id ? (
                  <div className="mt-3">
                    <Textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      placeholder={`Write your reply to ${c.email}`}
                      className="border-[#E3DCD2]"
                      data-testid={`reply-input-${c.id}`}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" onClick={() => sendReply(c)} disabled={sending || !draft.trim()} className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-lg" data-testid={`send-reply-${c.id}`}>
                        <Send className="w-3.5 h-3.5 mr-2" /> {sending ? "Sending..." : "Send Reply"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} disabled={sending} className="text-[#5C5042]" data-testid={`cancel-reply-${c.id}`}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => openReply(c.id)} className="px-0 text-[#D96C4A] hover:text-[#C25D3E]" data-testid={`reply-${c.id}`}>
                      Reply
                    </Button>
                    {!c.read && (
                      <Button variant="ghost" size="sm" onClick={() => markRead(c.id)} className="px-0 text-[#D96C4A] hover:text-[#C25D3E]" data-testid={`mark-read-${c.id}`}>
                        Mark as read
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
