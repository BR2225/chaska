import { useEffect, useMemo, useState } from "react";
import http from "@/lib/http";
import {
  CheckCircle2,
  Loader2,
  Pause,
  PenLine,
  Play,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL as API } from "@/config/api";
const EMPTY_FORM = { customer_name: "", email: "", rating: 0, comment: "" };

function ReviewerAvatar({ name }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className="review-avatar" aria-hidden="true">
      {initials || "C"}
    </span>
  );
}

function RatingStars({ rating, size = "small" }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`${size === "large" ? "h-5 w-5" : "h-4 w-4"} ${
            star <= rating ? "fill-[#F3B33D] text-[#F3B33D]" : "fill-transparent text-white/25"
          }`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, duplicate = false }) {
  return (
    <article className="review-card-modern" data-testid={duplicate ? undefined : `review-${review.id}`}>
      <div className="flex items-start justify-between gap-4">
        <RatingStars rating={review.rating} />
        <Quote className="h-8 w-8 text-[#D96C4A]/35" strokeWidth={1.2} aria-hidden="true" />
      </div>
      <blockquote className="mt-6 flex-1 text-[15px] leading-7 text-[#FDFBF7]/[0.82]">
        “{review.comment}”
      </blockquote>
      <footer className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
        <ReviewerAvatar name={review.customer_name} />
        <div>
          <p className="text-sm font-semibold text-white">{review.customer_name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#FDFBF7]/50">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#88A45F]" aria-hidden="true" />
            {review.source === "sample" ? "Sample review" : "Community review"}
          </p>
        </div>
      </footer>
    </article>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    http
      .get(`${API}/api/reviews`)
      .then(response => {
        if (active) setReviews(response.data);
      })
      .catch(() => {
        if (active) setReviews([]);
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = event => setPrefersReducedMotion(event.matches);
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  const averageRating = useMemo(() => {
    if (!reviews.length) return "—";
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const canAutoScroll = reviews.length > 1 && !prefersReducedMotion;
  const isAutoPlaying = canAutoScroll && !isPaused;

  const openReviewForm = () => {
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setDialogOpen(true);
  };

  const updateForm = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  };

  const submitReview = async event => {
    event.preventDefault();
    if (!form.rating) {
      toast.error("Please choose a star rating");
      return;
    }

    setSubmitting(true);
    try {
      await http.post(`${API}/api/reviews`, {
        customer_name: form.customer_name.trim(),
        email: form.email.trim(),
        rating: form.rating,
        comment: form.comment.trim(),
      });
      setSubmitted(true);
      toast.success("Your review was submitted for approval");
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === "string"
        ? detail
        : "We could not submit your review. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="reviews-section-modern py-24 sm:py-32"
      data-testid="reviews-section"
      role="region"
      aria-roledescription="carousel"
      aria-labelledby="reviews-heading"
    >
      <div className="reviews-glow reviews-glow-left" aria-hidden="true" />
      <div className="reviews-glow reviews-glow-right" aria-hidden="true" />

      {canAutoScroll && (
        <button
          type="button"
          onClick={() => setIsPaused(current => !current)}
          className="absolute right-6 top-6 z-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE8A67] focus-visible:ring-offset-2 focus-visible:ring-offset-[#241C17] sm:right-8 sm:top-8"
          aria-label={isPaused ? "Resume rotating customer reviews" : "Pause rotating customer reviews"}
          aria-pressed={isPaused}
          data-testid="reviews-motion-control"
        >
          {isPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          {isPaused ? "Resume" : "Pause"}
        </button>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#EE8A67]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Sweet words from our table
            </p>
            <h2
              id="reviews-heading"
              className="font-['Cormorant_Garamond'] text-4xl font-medium leading-[0.98] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Made with love.<br />Remembered by you.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#FDFBF7]/60 sm:text-base">
              Notes from dessert lovers who made Chaska part of their celebrations, cravings, and coffee breaks.
            </p>
          </div>

          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 backdrop-blur-sm">
              <span className="font-['Cormorant_Garamond'] text-4xl font-semibold leading-none text-white">
                {averageRating}
              </span>
              <span className="h-9 w-px bg-white/15" aria-hidden="true" />
              <div>
                <RatingStars rating={Math.round(Number(averageRating) || 0)} />
                <p className="mt-1 text-xs text-[#FDFBF7]/50">
                  {reviews.length} shared {reviews.length === 1 ? "note" : "notes"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={openReviewForm}
              className="h-12 rounded-full bg-[#D96C4A] px-6 text-white shadow-[0_12px_35px_rgba(217,108,74,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#E57A58] hover:shadow-[0_16px_42px_rgba(217,108,74,0.38)]"
              data-testid="open-review-form"
            >
              <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
              Share your experience
            </Button>
          </div>
        </div>

        <div className="mt-14 flex items-center justify-between border-t border-white/10 pt-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#FDFBF7]/40">
            Customer notes, on rotation
          </p>
          <span className="text-xs text-[#FDFBF7]/40">
            {canAutoScroll ? "Hover or focus to pause" : "Swipe to explore"}
          </span>
        </div>
      </div>

      <div
        className="reviews-viewport relative z-10 mt-8"
        tabIndex="0"
        onFocus={() => setIsPaused(true)}
        aria-label="Customer review cards"
      >
        {loadingReviews ? (
          <div className="reviews-loading-row px-6" aria-label="Loading customer reviews">
            {[1, 2, 3, 4].map(item => <div key={item} className="review-card-skeleton" />)}
          </div>
        ) : reviews.length > 0 ? (
          <div className={`reviews-track ${isAutoPlaying ? "is-playing" : "is-paused"}`}>
            <div className="reviews-group" aria-live={isAutoPlaying ? "off" : "polite"}>
              {reviews.map(review => <ReviewCard key={review.id} review={review} />)}
            </div>
            {canAutoScroll && (
              <div className="reviews-group" aria-hidden="true">
                {reviews.map(review => <ReviewCard key={`duplicate-${review.id}`} review={review} duplicate />)}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-xl px-6 py-12 text-center text-sm text-[#FDFBF7]/55">
            Be the first to leave a sweet note for Chaska.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-3xl border-[#E3DCD2] bg-[#FDFBF7] p-0 shadow-2xl sm:rounded-3xl">
          {submitted ? (
            <div className="px-7 py-12 text-center sm:px-10">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#88A45F]/15">
                <CheckCircle2 className="h-8 w-8 text-[#668044]" aria-hidden="true" />
              </span>
              <DialogHeader className="mt-6 text-center sm:text-center">
                <DialogTitle className="font-['Cormorant_Garamond'] text-3xl text-[#2C241B]">
                  Thank you for the sweet words
                </DialogTitle>
                <DialogDescription className="mt-3 leading-6 text-[#5C5042]">
                  Your review is safely with us and will appear here after a quick approval.
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="mt-7 rounded-full bg-[#2C241B] px-7 text-white hover:bg-[#44382C]"
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={submitReview} className="px-6 py-7 sm:px-8 sm:py-8" data-testid="review-form">
              <DialogHeader className="pr-8">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#D96C4A]">Your Chaska moment</p>
                <DialogTitle className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B]">
                  Leave a little love
                </DialogTitle>
                <DialogDescription className="pt-1 leading-6 text-[#6F6255]">
                  Tell us what made your dessert memorable. Reviews are published after approval.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-7 space-y-5">
                <fieldset>
                  <legend className="text-sm font-medium text-[#2C241B]">Your rating</legend>
                  <div className="mt-2 flex gap-1" data-testid="review-rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm(current => ({ ...current, rating: star }))}
                        className="rounded-lg p-1.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D96C4A]"
                        aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                        aria-pressed={form.rating === star}
                      >
                        <Star
                          className={`h-7 w-7 ${star <= form.rating ? "fill-[#F3B33D] text-[#F3B33D]" : "text-[#CFC5B8]"}`}
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <Label htmlFor="review-name" className="text-sm text-[#2C241B]">Full name</Label>
                  <Input
                    id="review-name"
                    name="customer_name"
                    value={form.customer_name}
                    onChange={updateForm}
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    required
                    placeholder="Your name"
                    className="mt-1.5 h-11 rounded-xl border-[#D9D0C5] bg-white focus-visible:ring-[#D96C4A]"
                    data-testid="review-name-input"
                  />
                </div>

                <div>
                  <Label htmlFor="review-email" className="text-sm text-[#2C241B]">Email</Label>
                  <Input
                    id="review-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateForm}
                    maxLength={320}
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    className="mt-1.5 h-11 rounded-xl border-[#D9D0C5] bg-white focus-visible:ring-[#D96C4A]"
                    data-testid="review-email-input"
                  />
                  <p className="mt-1.5 text-xs text-[#837668]">Your email is kept private and never shown with the review.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="review-comment" className="text-sm text-[#2C241B]">Your review</Label>
                    <span className="text-xs text-[#918577]">{form.comment.length}/1000</span>
                  </div>
                  <Textarea
                    id="review-comment"
                    name="comment"
                    value={form.comment}
                    onChange={updateForm}
                    minLength={10}
                    maxLength={1000}
                    rows={5}
                    required
                    placeholder="What did you try? What made it special?"
                    className="mt-1.5 resize-none rounded-xl border-[#D9D0C5] bg-white focus-visible:ring-[#D96C4A]"
                    data-testid="review-comment-input"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-full bg-[#D96C4A] text-white shadow-[0_10px_28px_rgba(217,108,74,0.24)] hover:bg-[#C85F40]"
                  data-testid="submit-review"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Submitting…</>
                  ) : (
                    <><PenLine className="mr-2 h-4 w-4" aria-hidden="true" />Submit review</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
