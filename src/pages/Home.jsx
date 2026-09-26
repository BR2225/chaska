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

      {/* Categories */}
      <section className="py-24 sm:py-32" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Our Specialties</p>
            <h2 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-medium text-[#2C241B] tracking-tight">
              Crafted with Tradition
            </h2>
            <p className="text-[#5C5042] max-w-2xl mx-auto mt-4 leading-relaxed">
              Every bomboloni, tiramisu and Italian-inspired dessert is handmade fresh in our Patia kitchen in Bhubaneswar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Bomboloni Card */}
            <Link to="/menu?category=bomboloni" className="group relative overflow-hidden rounded-2xl" data-testid="category-bomboloni">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1608894109526-ea487bf2c02c?w=800"
                  alt="Bomboloni"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C241B]/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-medium text-[#FDFBF7] mb-2">Bomboloni</h3>
                  <p className="text-[#FDFBF7]/80 text-sm">Florentine filled doughnuts, pillowy and irresistible</p>
                </div>
              </div>
            </Link>
            {/* Tiramisu Card */}
            <Link to="/menu?category=desserts" className="group relative overflow-hidden rounded-2xl" data-testid="category-tiramisu">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1714385905983-6f8e06fffae1?w=800"
                  alt="Tiramisu"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C241B]/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-medium text-[#FDFBF7] mb-2">Tiramisu</h3>
                  <p className="text-[#FDFBF7]/80 text-sm">The quintessential Italian layered dessert</p>
                </div>
              </div>
            </Link>
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

      {/* CTA */}
      <section
        className="relative py-24 sm:py-32 overflow-hidden"
        style={{ backgroundImage: `url(https://images.unsplash.com/photo-1764943162758-5724d0cf409b?w=1400)`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        data-testid="cta-section"
      >
        <div className="absolute inset-0 bg-[#2C241B]/60 backdrop-blur-sm" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl lg:text-5xl font-light text-[#FDFBF7] tracking-tight mb-6">
            Ready to Taste Italy?
          </h2>
          <p className="text-[#FDFBF7]/80 mb-8 leading-relaxed">
            Order online for delivery or visit our store for the freshest bomboloni and tiramisu in town.
          </p>
          <Link to="/menu">
            <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] hover:shadow-lg transition-all duration-300 rounded-full px-10 py-3 text-base font-medium h-auto" data-testid="cta-order-btn">
              Order Now
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
