// Shared between the server layout (inline script) and the client theme hook.
export const THEME_KEY = "devbot.theme";

export type ThemeMode = "system" | "dark" | "light";
export type Accent = "champagne" | "aurora" | "ember" | "verdant" | "mono";

export const ACCENTS: { id: Accent; name: string; swatch: [string, string] }[] = [
  { id: "champagne", name: "Champagne", swatch: ["#e9c27d", "#8fc2ff"] },
  { id: "aurora", name: "Aurora", swatch: ["#b9a4ff", "#5ee0c8"] },
  { id: "ember", name: "Ember", swatch: ["#ff9a62", "#ff8fb1"] },
  { id: "verdant", name: "Verdant", swatch: ["#8fdca4", "#7cc8ff"] },
  { id: "mono", name: "Graphite", swatch: ["#d4d4d8", "#a9b8cf"] },
];

/**
 * Runs in <head> before first paint: reads the saved preference and sets
 * data-theme / data-accent on <html> so there's no flash of the wrong theme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${THEME_KEY}")||"{}");var m=p.mode||"dark";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}var d=document.documentElement;d.setAttribute("data-theme",m);d.setAttribute("data-accent",p.accent||"champagne")}catch(e){}})()`;
