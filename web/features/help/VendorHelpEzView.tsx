"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, ChevronRight, Search, Send, Shield, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { submitVendorContact } from "@/lib/contactApi";
import { contactFormSchema, parseForm } from "@/lib/validation";
import { fetchConversationsPage, type ChatConversation } from "@/lib/chatApi";

const TOPICS = [
  {
    title: "Payments and payouts",
    body: "When you get paid, fees and Stripe setup.",
    icon: Wallet,
    query: "payout",
  },
  {
    title: "Bookings and quotes",
    body: "Accept, adjust, cancel and complete.",
    icon: Calendar,
    query: "cancel",
  },
  {
    title: "Disputes and refunds",
    body: "What happens when something goes wrong.",
    icon: Shield,
    query: "dispute",
  },
] as const;

const QUESTIONS = [
  {
    title: "When do I get paid?",
    body: "Your payout is released when you and the client both confirm the event is complete, or 48 hours after the event. It then reaches your bank in 1 to 3 working days.",
  },
  {
    title: "What fee does Eventtz charge?",
    body: "A service fee is added on top of your price and paid by the client. It does not reduce what you receive.",
  },
  {
    title: "What if a client cancels?",
    body: "Your cancellation policy, chosen on your profile, splits the vendor price. The Eventtz service fee is refunded to the client.",
  },
  {
    title: "How do I change my cancellation policy?",
    body: "Open your profile, edit Pricing and packages, and choose a new policy. Bookings already paid keep the policy from when they were booked.",
  },
  {
    title: "Can I pause my listing?",
    body: "Yes. On your profile, turn off “Show my profile in search”. Existing bookings are not affected.",
  },
] as const;

/** Vendor help (design V30): search, topics, questions, and a message to Eventtz. */
export function VendorHelpEzView() {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [openTitle, setOpenTitle] = useState<string>(QUESTIONS[0].title);
  const [topic, setTopic] = useState("Payouts");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatConversation[]>([]);

  useEffect(() => {
    void fetchConversationsPage(0, 50, "support")
      .then((page) => setThreads(page.conversations))
      .catch(() => setThreads([]));
  }, []);

  const questions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return QUESTIONS;
    return QUESTIONS.filter(
      (item) => item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle),
    );
  }, [query]);

  const send = async () => {
    setFormError(null);
    const parsed = parseForm(contactFormSchema, { message, bookingId: "" });
    if (!parsed.ok) {
      setFormError(parsed.formError);
      return;
    }
    setSending(true);
    try {
      const body = topic.trim() ? `${topic.trim()}\n\n${parsed.data.message}` : parsed.data.message;
      await submitVendorContact({ message: body, booking_id: parsed.data.bookingId });
      setMessage("");
      showToast({ title: "Message sent", tone: "success" });
    } catch {
      setFormError("Could not send your message. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ez-stack ez-stack--lg" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <PageHeader descriptionSize="body"
        eyebrow="Account"
        title="Help"
        description="Answers first, a person if you need one."
      />

      <div className="ez-search">
        <div className="ez-search__field">
          <Search size={18} strokeWidth={1.75} aria-hidden />
          <input
            className="ez-input"
            aria-label="Search help"
            placeholder="Search help, for example payouts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="ez-grid-3">
        {TOPICS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              className="ez-card"
              onClick={() => setQuery(item.query)}
            >
              <div className="ez-card__body">
                <div className="ez-stack ez-stack--sm">
                  <span className="ez-icon-tile">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="ez-strong">{item.title}</span>
                  <span className="ez-small">{item.body}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Popular questions</span>
            </div>
            <div className="ez-card__body">
              {questions.length === 0 ? (
                <p className="ez-small">No questions match that search.</p>
              ) : (
                questions.map((item) => {
                  const open = openTitle === item.title;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      className="ez-list-row"
                      style={{ alignItems: "flex-start", width: "100%", textAlign: "left" }}
                      aria-expanded={open}
                      onClick={() => setOpenTitle(open ? "" : item.title)}
                    >
                      <div className="ez-list-row__main">
                        <span className="ez-strong">{item.title}</span>
                        {open ? <span className="ez-small">{item.body}</span> : null}
                      </div>
                      {open ? (
                        <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Talk to us</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-stack ez-stack--sm">
                <span className="ez-small">We reply within one working day.</span>
                {formError ? <LottieFailureInline message={formError} /> : null}
                <div className="ez-field">
                  <label className="ez-label" htmlFor="help-topic">
                    Topic
                  </label>
                  <input
                    className="ez-input"
                    id="help-topic"
                    type="text"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  />
                </div>
                <div className="ez-field">
                  <label className="ez-label" htmlFor="help-message">
                    Message
                  </label>
                  <textarea
                    className="ez-input ez-input--area"
                    id="help-message"
                    placeholder="Tell us what is happening"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
                <button className="ez-btn ez-btn--primary" type="button" disabled={sending} onClick={() => void send()}>
                  <Send size={18} strokeWidth={1.75} aria-hidden />
                  {sending ? "Sending…" : "Send message"}
                </button>
              </div>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Your conversations</span>
            </div>
            <div className="ez-card__body">
              {threads.length === 0 ? (
                <EmptyState className="border-0" variant="support" title="No support conversations yet" />
              ) : (
                threads.map((thread) => (
                  <Link key={thread.id} className="ez-list-row" href={`/vendor/help/messages/${thread.id}`}>
                    <span className="ez-avatar ez-avatar--sm">
                      {thread.peer_display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="ez-list-row__main">
                      <span className="ez-strong">{thread.peer_display_name}</span>
                      <span className="ez-small">
                        {thread.unread_count > 0 ? `${thread.unread_count} unread` : "Eventtz Support"}
                      </span>
                    </div>
                    {thread.unread_count > 0 ? <span className="ez-badge ez-badge--info">Open</span> : null}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
