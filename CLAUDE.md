# VuePoint — Claude Code Skill

VuePoint is an internal JumpCloud tool for annotating live Vue 3 app UIs and sending structured feedback to AI coding agents.

## What you can do

When VuePoint MCP is connected, you have access to:

- `vuepoint_get_annotations` — see what UI issues the team has flagged
- `vuepoint_acknowledge` — let the annotator know you're working on it
- `vuepoint_resolve` — mark fixed, include a summary of what changed
- `vuepoint_dismiss` — mark as won't fix, with a reason
- `vuepoint_ask` — send a clarifying question back to the annotator
- `vuepoint_get_component_info` — inspect a component by selector or name
- `vuepoint_get_app_context` — get current route, page component, active stores

## Workflow

1. Call `vuepoint_get_annotations()` to see pending items
2. For each annotation, `vuepoint_acknowledge({ id })` to signal you're on it
3. Use the `selector`, `componentChain`, and `sfcPath` to find the exact code:
   - `selector` → grep/find in templates
   - `sfcPath` → open the exact `.vue` file
   - `componentChain` → understand the component hierarchy
4. Fix the issue
5. Call `vuepoint_resolve({ id, summary: "what you changed" })`

## Output format example

```
Selector:   .user-management-view .toolbar > .p-button:nth-child(2)
Component:  <App> → <UserManagementView> → <UserToolbar> → <PButton>
SFC Path:   src/views/users/UserManagementView.vue
Feedback:   Button stays active during loading state
Expected:   Button disabled + spinner while usersStore.loading === true
Actual:     Triggers duplicate API calls
```

## Tips

- The `componentChain` is ordered from app root to most specific component
- `sfcPath` is relative to the project root — use it directly with file tools
- PrimeVue internals are filtered out — you'll only see your own components
- If the annotation includes `piniaStores`, check those stores for relevant state
