# Styling system

The application uses Tailwind CSS v4 for styling, HeroUI for accessible components and Framer Motion for interactive transitions. Avoid adding a second component framework for an existing primitive.

## Entry points and ownership

- `index.css` is the only React stylesheet import. It registers Tailwind, HeroUI, fonts, source scanning and the modules in their deliberate cascade order. Keep that order unless changing precedence intentionally.
- `tokens.css` owns application CSS custom properties and theme variants. Some rules have different selector specificity; do not flatten them into one `:root` block. User preferences still set the same variables at runtime.
- `foundation.css`, `shell.css`, `surfaces.css`, `navigation.css`, `workspace.css`: shared application surfaces and navigation.
- `learning.css`, `library.css`, `books.css`, `reading-scale.css`: flashcards, books and reading.
- `exercise-layout.css`, `authoring.css`, `exercise-controls.css`, `exercise-motion.css`, `practice-session.css`, `practice-navigation.css`, `learning-feedback.css`: authoring and learning interactions.
- `profile.css`, `preferences.css`, `appearance.css`, `responsive.css`: profile, settings and shared responsive behavior.

## Writing and changing styles

Use utility classes directly for new, isolated layout. Use the shared HeroUI wrappers in `ui.jsx` for dialogs, buttons and surfaces. Existing stateful semantic selectors compose Tailwind utilities with `@apply`; their class names also act as behavior hooks and must not be renamed casually. Keep component rules in their owning module instead of appending global overrides.

These rules intentionally retain their original unlayered specificity during migration. Moving them into `@layer components` changes precedence against HeroUI and utility classes; do that only as an intentional component redesign. Do not assume adding a utility will override a semantic rule—change the owning component composition when needed.

Prefer named utilities (`flex`, `items-center`, `grid`, `overflow-hidden`). Arbitrary utilities keep exact values for custom layout, gradients, typography and 3D transforms. Pixel sizes were deliberately not approximated as rem values, because users can change font settings. Some rules have multiple `@apply` statements to preserve shorthand/longhand order (font/line-height, border, padding, etc.).

CSS declarations outside `@apply` are limited to custom properties and keyframes. Keep dynamic measurements, pointer coordinates, progress percentages and user-selected values in React inline styles: these are runtime data. Do not rewrite them as dynamically constructed Tailwind classes that the scanner cannot detect. User-authored HTML theory and the standalone reference `giaodien.html` are content, not application stylesheet sources.

## Build and verification

- `npm run build`: builds the independent React distribution.
- `npm run dev`: serves React with Vite HMR and proxies API/admin requests to Django.
- `npm run test:styles`: compiles the React modules and checks the migration baseline.
- `npm test`: style checks plus existing interaction, parsing, persistence and navigation tests.
- `npm run styles:baseline`: accepts a reviewed, intentional design change. Do not refresh the baseline just to hide a failing test.

The baselines were produced from the original application styles, then matched against the Tailwind output. They track declaration order within overlapping property families, selector structure, importance, media conditions, custom properties and keyframes. They are a code-level regression guard, not a claim that browser appearance or accessibility has been visually tested.

The migration retained the existing responsive and print behavior, reduced-motion/reduced-transparency handling, active/disabled/focus/error states, and theme preference hooks. New business logic or component replacement was not part of the stylesheet migration.

Django has no application styles or templates. The previous server stylesheet and build generator have been removed; only installed Django admin assets remain outside the frontend.

`context-panel.css` owns the contextual (back) navigation face and the centered learning stage. It is intentionally scoped to `.context-panel` / `.learning-stage` so primary navigation and flip behavior retain their styling. Page-wide links live on the primary face; the contextual face contains local tools, filters and content only.
