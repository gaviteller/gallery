import sys, os, glob

THEME = sys.argv[1]

ALL_FILES = [
    "app/(auth)/layout.tsx",
    "app/(auth)/signin/page.tsx",
    "app/(auth)/signup/page.tsx",
    "app/(auth)/verify-email/page.tsx",
    "app/commissions/page.tsx",
    "app/globals.css",
    "app/messages/page.tsx",
    "app/messages/[id]/page.tsx",
    "app/onboarding/page.tsx",
    "app/page.tsx",
    "app/professional-dms/page.tsx",
    "app/professional-dms/[id]/page.tsx",
    "app/professional-profile/page.tsx",
    "app/settings/page.tsx",
    "app/terms/page.tsx",
    "app/[username]/page.tsx",
    "components/BottomNav.tsx",
    "components/MessagesTabs.tsx",
    "components/PostModal.tsx",
    "app/hashtag/[tag]/page.tsx",
    "lib/sendEmail.ts",
]

THEMES = {
    "electric-blue": [
        # Gradient (full, before standalone color swaps)
        ("linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)"),
        ("linear-gradient(135deg,#FF1CF7,#B044F8)", "linear-gradient(135deg,#00D4FF,#6B5EFF)"),
        # Backgrounds
        ("#0D0D0F", "#070C1C"),
        ("#1e0d3f", "#0D1640"),
        ("#160b30", "#0A1030"),
        # rgba accents
        ("rgba(176,68,248", "rgba(107,94,255"),
        # Standalone brand color (SVG fills etc)
        ("#FF1CF7", "#00D4FF"),
        ("#B044F8", "#6B5EFF"),
        ("--brand-pink: #00D4FF", "--brand-pink: #00D4FF"),  # already replaced above
        # Tailwind purple → sky
        ("purple", "sky"),
        # border color for unread badge
        ("border-[#070C1C]", "border-[#070C1C]"),  # already correct
    ],
    "neon-pink-lime": [
        ("linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", "linear-gradient(135deg, #FF1493 0%, #CC33AA 50%, #AAFF00 100%)"),
        ("linear-gradient(135deg,#FF1CF7,#B044F8)", "linear-gradient(135deg,#FF1493,#CC33AA)"),
        ("#0D0D0F", "#000000"),
        ("#1e0d3f", "#111111"),
        ("#160b30", "#0A0A0A"),
        ("rgba(176,68,248", "rgba(255,20,147"),
        ("#FF1CF7", "#FF1493"),
        ("#B044F8", "#CC33AA"),
        ("purple", "pink"),
        ("border-[#000000]", "border-[#000000]"),
    ],
    "earthy": [
        ("linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", "linear-gradient(135deg, #C4937A 0%, #9B8260 50%, #6B7040 100%)"),
        ("linear-gradient(135deg,#FF1CF7,#B044F8)", "linear-gradient(135deg,#C4937A,#9B8260)"),
        ("#0D0D0F", "#0D0B09"),
        ("#1e0d3f", "#1F1A14"),
        ("#160b30", "#171210"),
        ("rgba(176,68,248", "rgba(196,147,122"),
        ("#FF1CF7", "#C4937A"),
        ("#B044F8", "#9B8260"),
        ("purple", "amber"),
        ("border-[#0D0B09]", "border-[#0D0B09]"),
    ],
}

replacements = THEMES[THEME]

changed = 0
for filepath in ALL_FILES:
    if not os.path.exists(filepath):
        continue
    with open(filepath, encoding="utf-8") as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        changed += 1
        print(f"  updated: {filepath}")

print(f"Done — {changed} files changed")
