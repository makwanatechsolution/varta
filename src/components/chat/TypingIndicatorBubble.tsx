import clsx from "clsx";

export function TypingIndicatorBubble() {
  return (
    <div className="flex gap-2 items-end">
      {/* Small varta-style diya-drop bubble */}
      <div className="relative rounded-2xl px-4 py-3 bg-[#202c33] rounded-tl-sm shadow-sm flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[#6EC6F0] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
