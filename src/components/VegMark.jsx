// The Indian vegetarian symbol: a green dot inside a green square.
export default function VegMark({ className = "" }) {
  return (
    <span
      role="img"
      aria-label="Vegetarian"
      title="Vegetarian"
      className={`inline-flex items-center justify-center w-4 h-4 flex-shrink-0 rounded-[2px] border-[1.5px] border-[#1E8E3E] bg-white ${className}`}
      data-testid="veg-mark"
    >
      <span className="w-2 h-2 rounded-full bg-[#1E8E3E]" />
    </span>
  );
}
