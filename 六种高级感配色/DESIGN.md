# Design System Specification: Editorial Depth & Tonal Contrast

## 1. Overview & Creative North Star: "The Digital Curator"
The Creative North Star for this design system is **The Digital Curator**. This philosophy treats the screen not as a flat interface, but as a physical gallery space where light, shadow, and material quality dictate importance. 

We move away from "Standard UI" by embracing **intentional asymmetry** and **tonal layering**. This system rejects the rigid, boxy constraints of traditional web grids in favor of a fluid, editorial layout. By overlapping elements and utilizing extreme shifts in typographic scale, we create a sense of high-end provenance and custom craftsmanship. The goal is "Chiaroscuro"—the dramatic use of light and dark to create depth and focus.

---

## 2. Color & Materiality
The palette is rooted in sophisticated saturation. We avoid the "neon" pitfalls of digital-first brands, opting instead for colors that feel like natural pigments, textiles, and minerals.

### The Six Social Color Stories
To maintain a high-end feel, these stories should be implemented as **Flowing Mesh Gradients** behind content, rather than flat backgrounds.

1.  **Deep Midnight Mint:** Base: `#121414`. Accents: `primary` (#63dbba) and `primary_container` (#003126).
2.  **Warm Espresso:** Base: `on_primary_fixed` (#002018). Accents: `secondary` (#d7c3b0) and `on_secondary_fixed_variant` (#524436).
3.  **Obsidain Lavender:** Base: `surface_container_lowest` (#0d0f0f). Accents: `tertiary` (#d9baf7) and `tertiary_container` (#371f51).
4.  **Slate Blue Frost:** Base: `surface_bright` (#383939). Accents: `outline` (#8c9291) and `inverse_primary` (#006b56). (Ensure 4.5:1 contrast).
5.  **Sage Earth:** Base: `surface_container`. Accents: `on_primary_container` (#1aa486) and `secondary_container` (#544738).
6.  **Dusk Rose:** Base: `surface_dim`. Accents: `error` (#ffb4ab) blended with `on_tertiary_fixed_variant` (#543c6f).

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. Use `surface_container_low` against `surface` to create a boundary. If a visual break is needed, use white space or a change in typography weight.

### The "Glass & Gradient" Rule
To achieve professional polish, utilize **Glassmorphism** for floating elements. Apply `backdrop-filter: blur(12px)` with a semi-transparent `surface_container` (60-80% opacity). Main CTAs should use a subtle gradient from `primary` to `primary_container` at a 135-degree angle to provide a "visual soul" that flat colors lack.

---

## 3. Typography: Editorial Authority
The typography scale utilizes **Epilogue** for high-impact display and **Manrope** for functional elegance.

*   **Display (Epilogue):** Set with tight letter-spacing (-0.02em). Use `display-lg` (3.5rem) for hero statements to create an "Editorial" look.
*   **Headlines (Epilogue):** Use `headline-sm` to `headline-lg` for section headers. These should often be asymmetric—positioned off-center to break the template feel.
*   **Body (Manrope):** `body-lg` (1rem) is the workhorse. It provides a modern, clean readability that balances the character of Epilogue.
*   **Labels (Manrope):** `label-sm` (0.6875rem) should be used in ALL CAPS with increased letter-spacing (+0.05em) for a premium, architectural feel.

---

## 4. Elevation & Depth: Tonal Layering
We do not use structural lines; we use **Material Stacking**.

*   **The Layering Principle:** Depth is achieved by stacking tiers. Place a `surface_container_highest` card on a `surface_container_low` background. This creates a natural "lift."
*   **Ambient Shadows:** For floating elements (like Social Share Cards), use "Micro-Shadows."
    *   *Spec:* `0px 10px 30px rgba(0, 0, 0, 0.08)`. The shadow should be tinted with the `on_surface` color to feel like natural light occlusion.
*   **The Ghost Border:** If accessibility requires a stroke, use `outline_variant` at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components & Interaction

### Buttons
*   **Primary:** Background: Gradient (`primary` to `primary_container`). Radius: `lg` (0.5rem). No border.
*   **Secondary:** Background: `secondary_container`. Text: `on_secondary_container`.
*   **Tertiary/Ghost:** Text: `primary`. No background. On hover, apply a `surface_container_high` background.

### Social Share Cards
The centerpiece of this system. They must use the **Flowing Mesh Gradient** (blending the three accent colors of the specific story) as the background. 
*   **Composition:** Place text in the bottom-left quadrant. Overlap a small `glassmorphic` element (like a tag or handle) across the top edge to break the container's boundary.
*   **Depth:** Apply the `xl` (0.75rem) roundedness and an Ambient Shadow.

### Input Fields
*   **Resting:** `surface_container_highest` background. No border. 
*   **Focus:** Transition to a "Ghost Border" using `primary` at 40% opacity. Label moves to `label-sm` styling above the field.

### List Items
*   **Constraint:** Forbid divider lines.
*   **Execution:** Use `body-lg` for titles and `body-sm` for metadata. Separate items using 24px of vertical white space. On hover, the entire background shifts to `surface_container_low`.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place images or text slightly off-grid to create a bespoke, high-end feel.
*   **Embrace Negative Space:** If a section feels crowded, double the padding. Premium design "breathes."
*   **Tone-on-Tone:** Use `primary_fixed_dim` text on `primary_container` backgrounds for sophisticated, low-contrast moments.

### Don’t:
*   **No Pure Black/White:** Use the `surface` and `on_surface` tokens. Pure `#000000` kills the "Chiaroscuro" depth.
*   **No Heavy Shadows:** If the shadow is clearly visible at a glance, it’s too heavy. It should be felt, not seen.
*   **No Default Grids:** Avoid the "three-column card row" whenever possible. Try a 2/3 and 1/3 split to maintain the editorial North Star.