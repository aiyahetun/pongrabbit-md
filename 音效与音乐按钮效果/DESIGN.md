# Design System: High-End Editorial Markdown Architecture

## 1. Overview & Creative North Star: "The Digital Curator"
The Creative North Star for this design system is **"The Digital Curator."** In a world of cluttered, utility-first editors, this system treats the act of writing as a high-end editorial experience. It moves away from the rigid, boxy constraints of traditional Windows software toward a fluid, "Advanced Sense" (高级感) aesthetic. 

The design breaks the "template" look through:
*   **Intentional Asymmetry:** Using generous, purposeful negative space to guide the eye rather than centering everything.
*   **Mica-Infused Depth:** Leveraging the Windows 11 Mica/Acrylic material language to create a sense of place and environmental integration.
*   **Typographic Authority:** Large, high-contrast headlines paired with breathable, meticulously tracked body text.

---

## 2. Colors: Atmospheric Tonality
The palette is a sophisticated transition from icy whites to deep, intellectual slates. It is designed to reduce eye strain while maintaining a "premium tech" feel.

### Surface Hierarchy & Nesting
Instead of lines, we use **Tonal Layering**. The UI is treated as stacked sheets of fine paper or frosted glass:
*   **Main Window (App Background):** `surface` (#f7fafe).
*   **Sidebar/Navigation:** `surface_container_low` (#eff4f9) to create a soft distinction.
*   **Active Editor Canvas:** `surface_container_lowest` (#ffffff) to prioritize focus and "lift" the writing area.
*   **Floating Inspect Panels:** `surface_container_high` (#e2e9f0) with 80% opacity and 20px backdrop blur.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off parts of the interface. Boundaries must be defined solely through color shifts between `surface_container` tiers. If you feel a border is needed, you have failed the layout's spatial breathing room.

### Signature Textures: The Glass & Gradient Rule
*   **Primary Action (CTA):** Use a linear gradient from `primary` (#356190) to `primary_dim` (#275584) at a 135-degree angle. This provides a tactile "soul" that flat colors lack.
*   **Floating Elements:** Use the `surface_variant` with a 60% alpha and a high blur radius (30px+) to emulate the Windows Mica effect.

---

## 3. Typography: Editorial Precision
The typography system is optimized for a bilingual experience, ensuring Inter (English) and PingFang SC/Microsoft YaHei (Chinese) share a consistent optical weight.

*   **Display & Headlines (`display-lg` to `headline-sm`):** Set with `-0.02em` letter spacing. These are the "voice" of the editor. Use `on_surface` (#2b343a) for maximum authority.
*   **The Body (`body-lg`):** The engine of the Markdown editor. Use `body-lg` (1rem) for the editor view with a line height of `1.7` to accommodate complex Chinese characters and prevent "visual crowding."
*   **Subtle Metadata (`label-md`):** Use `on_surface_variant` (#576067) to keep secondary information present but non-distracting.

---

## 4. Elevation & Depth: Atmospheric Shadowing
We define hierarchy through ambient light simulation rather than structural boxing.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface_container_lowest` card sitting on a `surface_container_low` background creates a natural, soft lift.
*   **Ambient Shadows:** For floating menus or modals, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(43, 52, 58, 0.06);`. The shadow color is a tinted version of `on_surface`, never pure black.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in high-contrast needs), use `outline_variant` (#aab3bb) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Minimalist Primitives

### Buttons
*   **Primary:** Gradient (`primary` to `primary_dim`), `DEFAULT` (0.5rem) roundedness, white text. No shadow on rest; subtle 4px blur shadow on hover.
*   **Tertiary (Ghost):** No background or border. Uses `primary` text. Hover state triggers a `surface_container` background fill with 40% opacity.

### Input Fields & Markdown Editor
*   **The Canvas:** No borders. The active line is highlighted by a subtle `surface_container_highest` background tint that spans the full width of the editor.
*   **Caret:** Use `secondary` (#33638a) with a soft pulse animation.

### Chips & Tags
*   **Style:** `surface_container_high` background, `md` (0.75rem) roundedness. 
*   **Interaction:** On hover, shift to `primary_container`.

### Cards & Lists
*   **Forbid Dividers:** Use `1.5rem` to `2rem` of vertical white space to separate list items. 
*   **Active State:** Use a 4px wide vertical "pill" of `primary` color on the left edge of a list item to indicate selection, rather than highlighting the whole box.

### Tooltips
*   **Aesthetic:** `inverse_surface` (#0b0f12) with 90% opacity. `sm` (0.25rem) corners. Typography: `label-sm` in `inverse_on_surface`.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use `surface_bright` for the very top-most layers to guide the user's attention.
*   **Do** prioritize Inter's medium weight for English headings to match the visual density of Chinese characters.
*   **Do** use thin, 1pt or 1.5pt stroke icons to maintain the "Editorial" elegance.

### Don't:
*   **Don't** use pure black (#000) or pure grey. Every "neutral" in this system is subtly infused with blue to maintain the cool, high-end atmosphere.
*   **Don't** use standard Windows "system" scrollbars. Implement a custom, thin `surface_dim` track with a `primary_fixed_dim` thumb.
*   **Don't** crowd the interface. If a feature isn't being used, it should be tucked away in a `surface_variant` acrylic overflow menu.