// Shared Tailwind utility strings for classes reused across multiple
// components, so the migration doesn't repeat a long class string at
// every call site. Each constant is the exact utility equivalent of the
// CSS rule it replaces.

export const RETRO_BTN =
	'inline-flex items-center gap-1.5 px-4 py-2.5 uppercase cursor-pointer outline-none text-[0.7rem] text-[var(--text-main)] bg-[var(--btn-bg)] border-2 border-[var(--accent-cyan)] shadow-[var(--box-shadow)] [font-family:var(--font-heading)] [transition:all_0.2s_ease] hover:-translate-y-0.5 hover:shadow-[var(--btn-hover-shadow)] active:translate-y-px'

// Base (idle, synthwave-default) look for `.theme-trigger-btn`. Every live
// consumer (NotificationBell, RetroNavbar) sets its own inline
// background/border/box-shadow, which already masks this rule's synthwave
// colors/hover/.active state in the CSS it replaces — confirmed via
// getComputedStyle before removing that CSS, not assumed. The literal
// `theme-trigger-btn` class name must stay on the element alongside this:
// the win95/terminal `[data-theme=...] .theme-trigger-btn { ... !important }`
// overrides in retrowave.css still target it and are untouched.
export const THEME_TRIGGER_BTN_BASE =
	"font-['Press_Start_2P',cursive] text-[0.65rem] h-[38px] w-[125px] px-2.5 box-border inline-flex items-center justify-between rounded gap-1 relative shrink-0 cursor-pointer outline-none [transition:background_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease,color_0.2s_ease]"

// Base look for `.theme-popover-menu`, already driven entirely by the
// --fs-bg/--fs-border/--fs-glow custom properties (redefined per
// [data-theme] in retrowave.css), so this keeps reskinning correctly
// across all 3 themes with zero theme-aware logic here. The `.active`/
// `.open-up.active` display+slide-animation trigger stays real CSS —
// it's a JS-state-driven transition, not a good Tailwind-arbitrary fit.
export const THEME_POPOVER_MENU_BASE =
	'absolute top-[calc(100%+10px)] right-0 z-[10001] hidden bg-[var(--fs-bg)] border-2 border-[var(--fs-border)] shadow-[0_14px_40px_rgba(0,0,0,.9),0_0_25px_var(--fs-glow)] p-2.5 rounded-md min-w-[240px] [transform-origin:top_right] backdrop-blur-[10px]'

// Auth form element styles (Login/Signup/ForgotPassword/ResetPassword/
// TwoFactor). Not theme-scoped anywhere in retrowave.css — these pages
// only ever render in the default synthwave look.
export const RETRO_AUTH_TITLE =
	"font-['Orbitron',sans-serif] font-black tracking-[2.5px] text-4xl leading-[1.1] bg-[linear-gradient(135deg,#00f0ff_0%,#ff007f_50%,#9d00ff_100%)] bg-clip-text text-transparent"

export const RETRO_AUTH_SUBTITLE =
	"text-[rgba(184,166,228,.8)] text-base mt-2.5 font-['Share_Tech_Mono',monospace]"

export const RETRO_AUTH_LABEL =
	"font-['Orbitron',sans-serif] text-xs font-bold tracking-[1.5px] text-[rgba(0,240,255,.75)] uppercase"

export const RETRO_AUTH_INPUT =
	"w-full [border:1.5px_solid_rgba(0,240,255,.28)] rounded-[11px] py-4 px-[18px] [font:500_16.5px_'Share_Tech_Mono',monospace] text-white bg-[rgba(0,0,0,.45)] outline-none [transition:all_0.2s_ease] box-border placeholder:text-[rgba(184,166,228,.35)] focus:border-[#00f0ff] focus:shadow-[0_0_18px_rgba(0,240,255,.35),inset_0_0_8px_rgba(0,240,255,.1)] focus:bg-[rgba(0,0,0,.6)]"

export const RETRO_AUTH_BTN =
	"border-0 rounded-xl py-[17px] px-[22px] [font:900_16px_'Orbitron',sans-serif] tracking-[1.8px] text-white cursor-pointer bg-[linear-gradient(135deg,#ff007f,#9d00ff)] shadow-[0_0_22px_rgba(255,0,127,.4),0_8px_26px_rgba(157,0,255,.35)] [transition:all_0.22s_ease] uppercase hover:-translate-y-px hover:shadow-[0_0_32px_rgba(255,0,127,.65),0_12px_34px_rgba(157,0,255,.45),0_0_65px_rgba(0,240,255,.2)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"

export const RETRO_AUTH_BTN_OUTLINE =
	"[border:1.5px_solid_rgba(0,240,255,.3)] rounded-[11px] py-[15px] px-[18px] [font:700_14.5px_'Share_Tech_Mono',monospace] text-[rgba(255,255,255,.88)] cursor-pointer bg-[rgba(0,240,255,.06)] [transition:all_0.2s_ease] flex items-center justify-center gap-2.5 hover:border-[#00f0ff] hover:bg-[rgba(0,240,255,.15)] hover:shadow-[0_0_16px_rgba(0,240,255,.3)] hover:text-white"

export const RETRO_AUTH_DIVIDER =
	"flex items-center gap-3.5 text-[rgba(184,166,228,.45)] [font:700_11px_'Orbitron',sans-serif] tracking-[2px]"

export const RETRO_AUTH_DIVIDER_LINE =
	'flex-1 h-px bg-[linear-gradient(90deg,transparent,rgba(0,240,255,.2),transparent)]'

export const RETRO_AUTH_LINK =
	"text-[#00f0ff] cursor-pointer font-bold no-underline [transition:color_0.18s_ease,text-shadow_0.18s_ease] hover:text-[#ff007f] hover:[text-shadow:0_0_10px_rgba(255,0,127,.5)]"

export const RETRO_AUTH_ERROR =
	"text-[#ff4081] text-[13px] leading-[1.4] font-['Share_Tech_Mono',monospace] py-2 px-3 rounded-lg bg-[rgba(255,0,127,.08)] border border-[rgba(255,0,127,.2)]"

export const RETRO_AUTH_SUCCESS =
	"text-[#33ff88] text-[13px] leading-[1.4] font-['Share_Tech_Mono',monospace] py-2 px-3 rounded-lg bg-[rgba(51,255,136,.08)] border border-[rgba(51,255,136,.2)]"

export const RETRO_AUTH_MUTED =
	"text-[rgba(184,166,228,.6)] text-[13px] font-['Share_Tech_Mono',monospace]"

// "Page shell" — shared across Home/Profile/Leaderboard/Friends/Lobby/
// Game/LudoLobby (7 pages). All fully driven by CSS custom properties
// (--bg-card, --card-border-style, --box-shadow, --window-header-bg/text,
// --bg-secondary, --accent-cyan, --font-heading), themselves redefined
// per [data-theme] in retrowave.css — so these keep reskinning correctly
// with zero theme-aware logic here, same as THEME_POPOVER_MENU_BASE.
// The separate win95/terminal `[data-theme=...] .retro-window { ... !important }`
// style overrides for .retro-window/.window-header/.window-body are left
// untouched in CSS (redundant with the vars, but harmless to keep).
export const CRT_SCREEN = 'relative z-10 min-h-screen'

export const APP_WRAPPER =
	'max-w-[calc(100vw-335px)] w-[calc(100%-325px)] ml-[310px] mr-auto p-[14px_20px_20px] relative z-10 box-border'

export const HERO_SECTION =
	'text-center p-[18px_20px_16px] bg-(--bg-card) [border:var(--card-border-style)] shadow-(--box-shadow) mb-[18px] relative overflow-hidden rounded'

export const HERO_TITLE =
	"[font-family:var(--font-heading)] text-[2.2rem] leading-[1.25] text-white [text-shadow:3px_3px_0_var(--accent-pink),-2px_-2px_0_var(--accent-cyan),0_0_22px_rgba(255,0,127,.85)] mb-2 tracking-[2px]"

export const HERO_SUBTITLE =
	"[font-family:var(--font-display)] text-[1.35rem] text-(--accent-yellow) [text-shadow:0_0_12px_var(--accent-yellow)] mb-0"

export const BADGE_BAR = 'flex justify-center gap-2.5 flex-wrap mt-2'

export const RETRO_BADGE =
	'bg-(--bg-secondary) border border-dashed border-(--accent-cyan) py-1 px-2.5 text-[0.74rem] text-(--accent-cyan)'

export const RETRO_WINDOW =
	'bg-(--bg-card) [border:var(--card-border-style)] shadow-(--box-shadow) rounded overflow-hidden flex flex-col'

export const WINDOW_HEADER =
	'bg-(--window-header-bg) text-(--window-header-text) py-2 px-3.5 [font-family:var(--font-heading)] text-[0.75rem] flex justify-between items-center select-none'

export const WINDOW_BODY = 'p-5 grow'

export const WINDOW_CONTROLS = 'flex gap-1.5'

export const WINDOW_BTN_MIN = 'w-3.5 h-3.5 rounded-xs border border-black/40 cursor-pointer bg-[#ffbd2e]'

export const WINDOW_BTN_MAX = 'w-3.5 h-3.5 rounded-xs border border-black/40 cursor-pointer bg-[#27c93f]'

// Leaderboard.tsx #1 podium card glow. Single-use, not theme-scoped.
export const APEX_CHAMPION_CARD =
	'scale-[1.02] shadow-[0_0_28px_rgba(255,23,68,.55),0_0_45px_rgba(255,215,0,.25),inset_0_0_16px_rgba(255,215,0,.15)] animate-none'

// Shared by Home/LudoLobby/Lobby/Game. Not theme-scoped.
export const DASHBOARD_GRID = 'grid grid-cols-12 gap-[25px] mb-[30px]'

// LudoLobby.tsx quick-deploy tickets. win95/terminal `!important` overrides
// on .retro-ticket-pass/.ticket-action-pill are left untouched in CSS —
// the literal class names stay on the elements alongside these.
export const RETRO_TICKET_PASS =
	'relative flex items-center justify-between rounded-xl py-[26px] px-8 min-h-[108px] gap-6 flex-wrap box-border cursor-pointer select-none [transition:transform_0.22s_cubic-bezier(.16,1,.3,1),box-shadow_0.22s_cubic-bezier(.16,1,.3,1),border-color_0.22s_ease,background_0.22s_ease] hover:-translate-y-1 active:translate-y-px'

export const TICKET_PINK =
	'bg-[linear-gradient(90deg,rgba(255,0,127,.22)_0%,rgba(20,6,42,.96)_100%)] border-2 border-[#ff007f] shadow-[0_4px_20px_rgba(0,0,0,.6),0_0_16px_rgba(255,0,127,.25)] hover:border-[#ff3399] hover:bg-[linear-gradient(90deg,rgba(255,0,127,.32)_0%,rgba(30,8,55,.98)_100%)] hover:shadow-[0_8px_30px_rgba(0,0,0,.75),0_0_28px_rgba(255,0,127,.55),inset_0_0_16px_rgba(255,0,127,.2)]'

export const TICKET_YELLOW =
	'bg-[linear-gradient(90deg,rgba(255,230,0,.2)_0%,rgba(20,6,42,.96)_100%)] border-2 border-[#ffe600] shadow-[0_4px_20px_rgba(0,0,0,.6),0_0_16px_rgba(255,230,0,.22)] hover:border-[#ffff33] hover:bg-[linear-gradient(90deg,rgba(255,230,0,.3)_0%,rgba(30,8,55,.98)_100%)] hover:shadow-[0_8px_30px_rgba(0,0,0,.75),0_0_28px_rgba(255,230,0,.5),inset_0_0_16px_rgba(255,230,0,.18)]'

export const TICKET_GREEN =
	'bg-[linear-gradient(90deg,rgba(0,255,136,.2)_0%,rgba(20,6,42,.96)_100%)] border-2 border-[#00ff88] shadow-[0_4px_20px_rgba(0,0,0,.6),0_0_16px_rgba(0,255,136,.22)] hover:border-[#33ffaa] hover:bg-[linear-gradient(90deg,rgba(0,255,136,.3)_0%,rgba(30,8,55,.98)_100%)] hover:shadow-[0_8px_30px_rgba(0,0,0,.75),0_0_28px_rgba(0,255,136,.5),inset_0_0_16px_rgba(0,255,136,.18)]'

export const TICKET_CYAN =
	'bg-[linear-gradient(90deg,rgba(0,240,255,.2)_0%,rgba(20,6,42,.96)_100%)] border-2 border-(--accent-cyan) shadow-[0_4px_20px_rgba(0,0,0,.6),0_0_16px_rgba(0,240,255,.22)] hover:border-[#33f6ff] hover:bg-[linear-gradient(90deg,rgba(0,240,255,.3)_0%,rgba(30,8,55,.98)_100%)] hover:shadow-[0_8px_30px_rgba(0,0,0,.75),0_0_28px_rgba(0,240,255,.5),inset_0_0_16px_rgba(0,240,255,.18)]'

export const TICKET_ACTION_PILL =
	'inline-flex items-center justify-center py-3 px-6 rounded-md [font-family:var(--font-heading)] text-[0.9rem] font-black tracking-[1px] [transition:all_0.2s_ease] pointer-events-none shrink-0'

// Home.tsx arcade cabinet + grid columns + footer. win95/terminal
// `!important` overrides on .arcade-start-overlay/.arcade-start-title/
// .arcade-start-sub are left untouched in CSS — literal class names kept
// alongside these on the elements. The "CYBERSOUND DECK" cassette-player
// widget (cyber-cassette-chassis/oled-*/cyber-eq-*/cyber-transport-cluster/
// cyber-deck-key*/cyber-vol-*) is deliberately left entirely as CSS: heavy
// win95/terminal re-theming plus .lit-cyan/.lit-amber/.lit-pink state
// classes and :active variants — same complexity class as CyberModal.
export const ARCADE_CONTAINER = 'flex flex-col items-center gap-[15px]'

export const ARCADE_SCREEN_FRAME =
	'bg-black p-0 border-4 border-[#333333] shadow-[inset_0_0_20px_#000000,0_0_15px_var(--accent-cyan)] relative overflow-hidden w-full h-full cursor-pointer [transition:all_0.2s_ease]'

export const ARCADE_START_OVERLAY =
	'absolute bottom-6 left-1/2 -translate-x-1/2 w-[82%] max-w-[580px] bg-[rgba(13,2,33,.45)] backdrop-blur-[8px] border-2 border-(--accent-pink) shadow-[0_0_20px_rgba(255,0,127,.35),inset_0_0_12px_rgba(0,240,255,.2)] rounded-md py-3 px-[18px] text-center flex flex-col items-center gap-1.5 pointer-events-none [animation:arcade-start-pulse_1.8s_infinite_ease-in-out] [transition:all_0.2s_ease] box-border'

export const ARCADE_START_TITLE =
	'[font-family:var(--font-heading)] text-[0.95rem] text-(--accent-yellow) [text-shadow:0_0_10px_var(--accent-yellow),0_0_20px_var(--accent-pink)] tracking-[1.5px] font-bold'

export const ARCADE_START_SUB = '[font-family:var(--font-mono)] text-[0.82rem] text-(--accent-cyan) tracking-[0.5px]'

export const COL_4 = 'col-span-4 max-[992px]:col-span-12'

export const COL_8 = 'col-span-8 max-[992px]:col-span-12'

export const RETRO_FOOTER =
	'text-center p-5 bg-(--bg-card) [border:var(--card-border-style)] mt-5 text-[0.85rem] text-(--text-muted)'

// CyberModal.tsx overlay backdrop only — the one genuinely self-contained,
// static piece of this component. Everything else (cyber-btn's clip-path
// + mask-composite:intersect bevel-cut construction, the hover glitch
// layer + animated letter stagger via :nth-of-type, the modal box's own
// clip-path bevel and ::before/::after scanline system gated on .is-open/
// .glitching) is deliberately left as CSS: it's built on CSS custom
// properties threaded through many interdependent rules plus advanced
// techniques (mask-composite, clip-path polygons) that Tailwind has no
// shortcut for — "converting" it would mean pasting the same CSS into
// arbitrary-value brackets with no practical benefit, real transcription
// risk, and (per the RankBadge lesson) a real chance of the scanner
// silently dropping generated rules — while also being effectively
// impossible to verify thoroughly via screenshots (hover-triggered,
// timed, keyframe-driven). `.active`'s opacity/pointer-events toggle
// stays as tiny CSS, matching the pattern used for other JS-state
// triggers throughout this migration.
export const CYBER_MODAL_OVERLAY =
	'fixed inset-0 bg-[rgba(5,2,14,.78)] backdrop-blur-[12px] backdrop-saturate-[1.8] z-[10002] grid place-items-center p-6 [transition:opacity_0.3s_ease]'
