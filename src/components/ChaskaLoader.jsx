/**
 * The walking Chaska mark, reused as the app's loading indicator so every wait
 * looks like the brand rather than a spinner or the word "Loading".
 *
 * The walk cycle lives in index.css on .chaska-walker and runs on its own, so
 * this only supplies the markup. Screen readers get the label; the animation
 * itself is decorative and hidden from them.
 */
export default function ChaskaLoader({ label = "Loading", fullScreen = true, className = "" }) {
  return (
    <div
      className={`flex ${fullScreen ? "min-h-screen" : "py-16"} items-center justify-center bg-[#FDF0DB] ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="chaska-walker" aria-hidden="true">
        <span className="chaska-walker__character">
          <img src="/chaska-mark.png" alt="" className="chaska-walker__mark" />
          <span className="chaska-walker__foot chaska-walker__foot--left" />
          <span className="chaska-walker__foot chaska-walker__foot--right" />
        </span>
        <span className="chaska-walker__shadow" />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
