import { useCallback } from "react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// Standard emoji data grouped by category
const EMOJI_CATEGORIES = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕"],
  },
  {
    label: "Gestures",
    icon: "👋",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄"],
  },
  {
    label: "Hearts & Love",
    icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☯️","🔥","💯","💢","💥","💫","⭐","🌟","✨","🎉","🎊","🎈","🎀","🎁"],
  },
  {
    label: "Animals",
    icon: "🐶",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️","🦔"],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: ["🍕","🍔","🌮","🌯","🥪","🥗","🍜","🍝","🍛","🍣","🍱","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧆","🥚","🍳","🥘","🍲","🥣","🥧","🧇","🥞","🧈","🍞","🥐","🥖","🫓","🥨","🥯","🧀","🥩","🥓","🌭","🍟","🫔","🧆","🥙","🫕","🥫","🧂","🥦","🧄","🧅","🍄","🌽","🌶️","🫑","🥕","🧑‍🍳","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🫒","🍠"],
  },
  {
    label: "Activities",
    icon: "⚽",
    emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🎿","🛷","🥌","🎯","🪀","🪆","🎮","🕹️","🎲","🎭","🎨","🖼️","🎪","🎤","🎧","🎼","🎵","🎶","🎷","🎸","🎹","🎺","🎻","🪕","🥁","🪘","🎬","🎤"],
  },
  {
    label: "Travel",
    icon: "🚀",
    emojis: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🛺","🚲","🛴","🛹","🛼","🚁","🛸","🚀","✈️","🛩️","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","🗺️","🧭","🗼","🗽","🗿","🗺️","🏔️","🌋","🏕️","🏖️","🏜️","🏝️","🏞️","🌅","🌄","🌇","🌆","🌃","🌉","🌌"],
  },
  {
    label: "Objects",
    icon: "💡",
    emojis: ["💡","🔦","🕯️","🪔","💰","💴","💵","💶","💷","💸","💳","🪙","💎","⚖️","🧲","🪜","🔧","🪛","🔩","⚙️","🗜️","🔫","💣","🪓","🔪","🗡️","🛡️","🔑","🗝️","🔐","🔒","🔓","🚪","🪞","🛋️","🚿","🛁","🪣","📱","💻","🖥️","⌨️","🖱️","📷","📸","📹","🎥","📺","📻","📞","☎️","📟","📠","🔋","🔌","💿","📀","🖨️","📡","🧯","🪬","🔭","🔬","🧬","💊","🩺","🏥","🚨","🚔","🚍","🚘","🚖"],
  },
];

const QUICK_REACTIONS = ["👍","❤️","😂","🔥","👏","😮","😢","😡"];

function getFrequent(): string[] {
  try {
    const raw = localStorage.getItem("varta_frequent_emoji");
    return raw ? (JSON.parse(raw) as string[]).slice(0, 8) : [];
  } catch { return []; }
}

function recordUsed(emoji: string) {
  try {
    const prev = getFrequent();
    const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 8);
    localStorage.setItem("varta_frequent_emoji", JSON.stringify(next));
  } catch { /* noop */ }
}

// ─── useReactions (message reactions hook) ───────────────────────────────────

export function useReactions(messageId: string) {
  const { user } = useAuth();

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!user) return;
      recordUsed(emoji);

      const { data: existing } = await supabase
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      }
    },
    [messageId, user],
  );

  return { toggleReaction, quickReactions: QUICK_REACTIONS };
}

// ─── EmojiPickerPanel ────────────────────────────────────────────────────────

interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerPanel({ onSelect, onClose }: EmojiPickerPanelProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [frequent, setFrequent] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFrequent(getFrequent());
    searchRef.current?.focus();
  }, []);

  const pick = (emoji: string) => {
    recordUsed(emoji);
    setFrequent(getFrequent());
    onSelect(emoji);
    onClose();
  };

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
        // simple character match — good enough for emoji search
        e.includes(search),
      )
    : null;

  return (
    <div
      className="emoji-picker"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="emoji-picker__search-bar">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="emoji-picker__search"
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="emoji-picker__tabs">
          {frequent.length > 0 && (
            <button
              type="button"
              className={`emoji-picker__tab ${activeCategory === -1 ? "active" : ""}`}
              onClick={() => setActiveCategory(-1)}
              title="Frequently used"
            >
              ⭐
            </button>
          )}
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              className={`emoji-picker__tab ${activeCategory === i ? "active" : ""}`}
              onClick={() => setActiveCategory(i)}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="emoji-picker__grid">
        {filteredEmojis
          ? filteredEmojis.map((e) => (
              <button key={e} type="button" className="emoji-picker__btn" onClick={() => pick(e)}>
                {e}
              </button>
            ))
          : activeCategory === -1
          ? frequent.map((e) => (
              <button key={e} type="button" className="emoji-picker__btn" onClick={() => pick(e)}>
                {e}
              </button>
            ))
          : EMOJI_CATEGORIES[activeCategory]?.emojis.map((e) => (
              <button key={e} type="button" className="emoji-picker__btn" onClick={() => pick(e)}>
                {e}
              </button>
            ))}
      </div>
    </div>
  );
}
