# Quick Copy Mode

## Summary

Add a ⌘C/Ctrl+C shortcut during annotation mode that instantly copies element context to clipboard without opening the annotation form. Inspired by React Grab's hover-and-copy workflow.

## Motivation

VuePoint's annotation workflow is thorough but heavyweight for quick context grabs. When you just need to paste a selector + component chain into a chat with an agent, the full form is unnecessary. Quick copy bridges that gap.

## Design

### New core function: `formatElementContext()`

In `packages/core/src/output.ts`:

```ts
export function formatElementContext(opts: {
  elementDescription: string
  selector: string
  componentChain: VueComponentInfo[]
}): string
```

Output format:
```
<button> "Save Changes"
in <App> → <UserToolbar> → <PButton>
at src/components/users/UserToolbar.vue
Selector: .user-toolbar > button.primary
```

- Line 1: element description (always present)
- Line 2: component chain (omitted if empty)
- Line 3: SFC path of deepest component with a file (omitted if none)
- Line 4: CSS selector (always present)

### Toolbar keyboard listener

In `VuePointToolbar.vue`, during annotation mode:

- Listen for `keydown` where `key === 'c'` and `metaKey || ctrlKey` is true
- Guard: only fires when `hoveredElement` is non-null
- Calls `e.preventDefault()` to suppress native copy
- Builds compact string via `formatElementContext()`
- Writes to `navigator.clipboard.writeText()`
- Shows brief "Copied!" toast (1.5s) using existing overlay position

### Toast

- Reuses highlight overlay bounding rect for positioning
- `quickCopied` ref + `<Transition>` — same pattern as existing `copied` ref
- No new component

## Files changed

| File | Change |
|------|--------|
| `packages/core/src/output.ts` | Add `formatElementContext()` |
| `packages/core/src/output.test.ts` | Add test cases |
| `packages/core/src/index.ts` | Export new function |
| `packages/vue/src/components/VuePointToolbar.vue` | Keydown listener + toast |

## What doesn't change

- Regular click still opens annotation panel
- Shift+drag, Alt+drag, text selection — all unchanged
- Quick copy only works during annotation mode (crosshair active)
- No new dependencies
