# Design System Document: macOS High-End Editorial

## 1. Overview & Creative North Star: "The Translucent Editor"
This design system is engineered to transform a functional Markdown utility into a premium editorial environment. Moving beyond the rigid, opaque structures of traditional desktop software, our **Creative North Star** is **"The Translucent Editor."** 

This philosophy treats the UI not as a collection of static boxes, but as a series of suspended, high-fidelity glass panes. We break the "template" look through intentional asymmetry—placing high-contrast typography against soft, blurred backgrounds. The goal is to provide a "breathing" workspace where the user’s content is the hero, framed by a native macOS aesthetic that feels both authoritative and ethereal.

---

## 2. Colors & Surface Philosophy

Our palette leverages Material Design token naming but applies them through a high-end macOS lens.

### Tonal Foundations
*   **Primary (`#0058bc`):** Used sparingly for focus and meaningful actions.
*   **Surface (`#f9f9fe`):** The base canvas.
*   **Tertiary (`#9e3d00`):** Reserved for accent callouts or "editorial notes."

### The "No-Line" Rule
**Explicit Instruction:** Use of 1px solid borders for sectioning is prohibited. 
Structural boundaries must be defined solely through background color shifts. For example, a sidebar using `surface-container-low` achieves its boundary by simply sitting against a `surface` editor area. 

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. Depth is achieved by nesting tokens:
1.  **Level 0 (Base):** `surface`
2.  **Level 1 (In-set Content):** `surface-container-low`
3.  **Level 2 (Active Cards/Modals):** `surface-container-highest`

### The "Glass & Gradient" Rule
For the high-fidelity macOS version, implement **Vibrancy (Backdrop Blur)**. 
- **Sidebar/Toolbar:** Use `surface` at 70% opacity with a 30px backdrop blur. 
- **CTAs:** Instead of flat fills, apply a subtle linear gradient from `primary` to `primary-container` to provide "soul" and depth.

---

## 3. Typography: Editorial Authority

We use a dual-font system to balance modern tech with classical editorial vibes.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision. 
    *   *Display-Lg (3.5rem):* Use for empty states or splash screens to create a bold, "magazine" feel.
    *   *Headline-Sm (1.5rem):* Standard for document titles.
*   **Body & Labels (Inter):** The workhorse for legibility.
    *   *Body-Lg (1rem):* Optimized for long-form writing.
    *   *Label-Sm (0.6875rem):* Used for metadata (word count, file path) with increased letter spacing for a premium look.

The contrast between the wide, expressive Manrope headlines and the tight, functional Inter body text creates an "Editorial" hierarchy that feels curated rather than generic.

---

## 4. Elevation & Depth: Tonal Layering

We abandon traditional structural lines in favor of **Ambient Light Simulation.**

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. The shift in tone creates a "soft lift" that is felt rather than seen.
*   **Ambient Shadows:** For floating elements (like the macOS "Traffic Lights" or popover menus), use a shadow color derived from `on-surface` at 6% opacity with a 24px blur and 8px Y-offset. This mimics natural light.
*   **The "Ghost Border" Fallback:** If a divider is required for accessibility, use `outline-variant` at **15% opacity**. Never use 100% opaque lines.
*   **Frosted Glass:** Leverage the macOS vibrancy effect. This allows the user's wallpaper to bleed through the `surface` color, integrating the app into the user’s personal desktop environment.

---

## 5. Components

### Navigation & Toolbars
- **Window Controls:** Native macOS "Traffic Lights" must be positioned in the top-left with a 20px padding.
- **Sidebars:** Use `surface-container-low` with a semi-transparent blur. No border on the right; use a subtle tonal shift to the editor’s `surface`.

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `xl` (1.5rem) rounded corners.
- **Secondary:** Transparent background with `on-secondary-container` text.
- **Tertiary:** Subtle `surface-variant` hover state; no container in resting state.

### Input Fields & Editor
- **The Writing Canvas:** Zero borders. The cursor and typography hierarchy should define the space.
- **Checkboxes:** When checked, use `primary` with a white check. When unchecked, use a "Ghost Border" (`outline-variant` at 20%).

### Chips & Metadata
- **Selection Chips:** Use `secondary-fixed` for the container with `on-secondary-fixed` text.
- **Spacing:** Forbid dividers in lists. Use `0.75rem` vertical padding (from the spacing scale) to create clear content separation.

---

## 6. Do’s and Don’ts

### Do
- **DO** use `lg` (1rem) to `xl` (1.5rem) corner radii for all containers to match the macOS aesthetic.
- **DO** utilize white space as a structural element. If in doubt, add more padding.
- **DO** use `surface-bright` for active states in dark mode to create a "glowing" editorial focus.

### Don't
- **DON'T** use 1px solid black or grey lines to separate the sidebar from the editor.
- **DON'T** use standard "drop shadows" with high opacity. They look "Windows-native" rather than "macOS-native."
- **DON'T** mix font families. Stick strictly to Manrope for headers and Inter for interface/body.
- **DON'T** use `error` red for anything other than destructive actions. For "warnings" or "alerts," use the `tertiary` orange/brown palette to maintain the sophisticated tonal range.