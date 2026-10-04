"use client";

/** First stop for keyboard users: jumps past the header and scenery to the page's main content. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="pp-skip-link"
      onClick={(e) => {
        const main = document.getElementById("main") ?? document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
    >
      Skip to the main deck
    </a>
  );
}
