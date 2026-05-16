# @travelgenix/ui

The shared design system for every Travelgenix admin surface, portal, and dashboard.

This package exists because we were drifting. Every new admin (Luna Travel, Luna Work, Luna Marketing, Luna Chat dashboard, widget editor) was reinterpreting the design skill from scratch and producing slightly different versions of the same component. This package makes that drift impossible.

## What's in here

```
@travelgenix/ui/
├── tokens.css          // The single source of truth for all visual values
├── tailwind-preset.js  // Tailwind config preset to extend
├── components.jsx      // Core React components
└── README.md           // This file
```

## Setup in a new project

**1. Install (in real life this would be `npm install @travelgenix/ui`)**

For now, while the package lives as a workspace folder, point to it directly:

```json
// package.json
"dependencies": {
  "@travelgenix/ui": "workspace:*"
}
```

**2. Extend the Tailwind preset**

```js
// tailwind.config.js
import tgPreset from '@travelgenix/ui/tailwind-preset';

export default {
  presets: [tgPreset],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
};
```

**3. Import tokens**

```css
/* app/globals.css */
@import '@travelgenix/ui/tokens.css';
@import 'tailwindcss';
```

**4. Use components**

```jsx
import { Button, Input, KPIStrip, Sidebar, PageHeader } from '@travelgenix/ui';

<PageHeader 
  eyebrow="Travelgenix admin"
  title="Overview"
  action={<Button variant="primary">New agency</Button>}
/>
```

## Design rules this package enforces

These come from the `travelgenix-design` skill and cannot be overridden:

- **15px minimum body text** (avoids iOS auto-zoom)
- **44px minimum touch targets** on interactive elements
- **4px spacing grid** — no arbitrary values
- **Border radius tokens** — 6/8/12/16/20px only
- **Shadow tokens** — no arbitrary box-shadow values
- **Light mode default, dark mode always working** — via `data-theme="dark"` attribute
- **Focus rings on every interactive element**
- **`prefers-reduced-motion` respected**
- **Lucide icons only**, never emoji as functional icons
- **Inter font** for all Travelgenix-branded surfaces

## When to override

You don't. If something genuinely needs to look different, the rule belongs in this package, not in your project.

If you find yourself reaching for `bg-[#1B2B5B]` instead of `bg-tg-primary`, stop. That hex value drifting into a component is exactly what this package exists to prevent.

## Adding new components

When a new component is needed across more than one admin surface, it goes here. The decision criteria:

- **Used in 2+ admin products?** → goes in the package
- **Has variants that need to behave consistently?** → goes in the package
- **Genuinely product-specific** (e.g. Luna Travel's phone preview, Luna Marketing's content calendar)? → stays in the product

## Roadmap

**Now (v0.1):** Tokens, Tailwind preset, ~15 core components.

**Next (v0.2):** Modal, Dropdown, Toast, DatePicker, ColorPicker, FileUpload, Tooltip, ConfirmDialog.

**Later (v0.3):** DataTable with sort/filter/pagination, ChartContainer, RichTextEditor, FormBuilder.

**Eventually (v1.0):** Lifted out of the Luna Travel repo into its own private repo, published to a private npm registry, with Storybook for documentation.
