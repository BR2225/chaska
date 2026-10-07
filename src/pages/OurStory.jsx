import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Tony's account of starting Chaska, set as text rather than shipped as the
 * image it arrived in: a picture of words cannot be read by a screen reader,
 * cannot be found in a search, and cannot reflow on a phone.
 */
export default function OurStory() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 bg-[#FDF0DB]" data-testid="our-story-page">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] font-medium">Our Story</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl lg:text-6xl font-medium text-[#2C241B] tracking-tight mt-3 mb-12">
          Everyone has a story.
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div className="space-y-6 text-[#5C5042] leading-relaxed text-base sm:text-lg">
            <p>
              Mine started with just{" "}
              <span className="font-semibold text-[#2C241B] bg-[#E9B949]/25 px-1.5 py-0.5 rounded">&#8377;700</span>.
              I put that little amount into an idea. I didn&apos;t know how it would become Chaska.
            </p>
            <p>
              I was learning everything from scratch — recipes, costing, packaging, marketing
              and so much more.
            </p>
            <p>
              With a lot of questions, mistakes and late nights, I kept trying. And with the
              help of ChatGPT, I kept learning and figuring things out.
            </p>
            <p>
              But the best part has always been you — the people who tasted Chaska, came back,
              gave feedback, and made me believe this could become something.
            </p>
            <p className="text-[#2C241B]">
              <span className="font-semibold bg-[#E9B949]/25 px-1.5 py-0.5 rounded">&#8377;700</span>{" "}
              started it. You helped me grow it.
            </p>
            <p className="font-['Cormorant_Garamond'] text-3xl text-[#2C241B] pt-2">— Tony</p>

            <div className="pt-4">
              <Link to="/menu">
                <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] hover:shadow-lg transition-all duration-300 rounded-full px-8 py-3 text-base font-medium h-auto">
                  See the Menu <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-[#F4EADB]">
            <img
              src="/our-story.jpg"
              alt="Tony filling a fresh bombolone with chocolate at the Chaska cart"
              width={953}
              height={1000}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
