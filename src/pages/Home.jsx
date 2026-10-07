import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import http from "@/lib/http";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ReviewsSection from "@/components/ReviewsSection";
import { Button } from "@/components/ui/button";
import { API_BASE_URL as API } from "@/config/api";

export default function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    http.get(`${API}/api/products?featured=true`).then(r => setFeatured(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="home-page">
      {/* Hero */}
      <section
        className="relative bg-[#FDF0DB] pt-16 sm:pt-20"
        data-testid="hero-section"
      >
        {/* The illustration carries the shop's name, so the page keeps a heading
            for search engines and screen readers without printing it twice. */}
        <h1 className="sr-only">
          CHASKA — handmade bomboloni, tiramisu and Italian-inspired desserts in Patia, Bhubaneswar
        </h1>
        {/* Shown whole rather than cropped to fill: the artwork is 2.39:1, so
            covering a tall phone screen would leave a narrow strip of its middle.
            Its edges are the same cream as this section, so it meets the page
            without a seam at any width. */}
        <picture>
          {/* Narrow screens take a tighter crop of the same artwork. At full
              width the 2.39:1 version stands about 163px tall on a phone, which
              leaves the stall too small to read; this one stands about 273px. */}
          <source
            media="(max-width: 640px)"
            srcSet="/chaska-hero-mobile.jpg"
            width={1000}
            height={700}
          />
          <img
            src="/chaska-hero.jpg"
            alt="A Chaska market stall, with a baker piping chocolate into freshly fried bomboloni"
            width={1672}
            height={700}
            className="w-full h-auto"
          />
        </picture>
        <div className="flex flex-col sm:flex-row gap-4 justify-center px-6 pt-8 pb-16 sm:pb-20 opacity-0 animate-fade-in-up animate-delay-100">
          <Link to="/menu">
            <Button className="w-full sm:w-auto bg-[#D96C4A] text-white hover:bg-[#C25D3E] hover:shadow-lg transition-all duration-300 rounded-full px-8 py-3 text-base font-medium h-auto" data-testid="hero-order-btn">
              Order Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link to="/menu">
            <Button variant="outline" className="w-full sm:w-auto bg-transparent text-[#2C241B] border-[#2C241B]/40 hover:bg-[#2C241B] hover:text-[#FDF0DB] transition-all duration-300 rounded-full px-8 py-3 text-base font-medium h-auto" data-testid="hero-menu-btn">
              View Menu
            </Button>
          </Link>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 sm:py-32" data-testid="story-section">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Our Story</p>
              <h2 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl lg:text-5xl font-medium text-[#2C241B] tracking-tight mb-6">
                Everyone has a story.
              </h2>
              <div className="space-y-4 text-[#5C5042] leading-relaxed">
                <p>
                  Mine started with just{" "}
                  <span className="font-semibold text-[#2C241B] bg-[#E9B949]/25 px-1.5 py-0.5 rounded">&#8377;700</span>.
                  I put that little amount into an idea. I didn&apos;t know how it would become Chaska.
                </p>
                <p>
                  With a lot of questions, mistakes and late nights, I kept trying — and the best
                  part has always been you, the people who tasted Chaska and came back.
                </p>
              </div>
              <p className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B] mt-6">— Tony</p>
              <Link
                to="/our-story"
                className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-[#D96C4A] hover:text-[#C25D3E] transition-colors"
                data-testid="read-our-story"
              >
                Read the whole story <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#F4EADB]">
              <img
                src="/our-story.jpg"
                alt="Tony filling a fresh bombolone with chocolate at the Chaska cart"
                width={953}
                height={1000}
                loading="lazy"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="py-24 sm:py-32 bg-[#F4F0E6]" data-testid="featured-section">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Must Try</p>
                <h2 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-medium text-[#2C241B] tracking-tight">
                  Featured Desserts
                </h2>
              </div>
              <Link to="/menu" className="hidden sm:flex items-center gap-2 text-sm text-[#D96C4A] hover:text-[#C25D3E] font-medium transition-colors">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      <ReviewsSection />
    </div>
  );
}
