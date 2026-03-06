# For PMs & Designers

This guide walks you through using VuePoint to annotate your app's UI and send structured feedback to AI coding agents — no terminal or code editor required.

::: tip Prerequisites
Your development team has already installed VuePoint on a staging or development URL. If you don't have a URL yet, ask a developer to [set it up](/guide/getting-started) and share the link with you.
:::

## Step 1: Open Your Staging App

Open the staging or development URL your team has shared with you in **Chrome**, **Firefox**, or **Edge**. VuePoint is only active in development/staging environments — it won't appear on production URLs.

You should see a small floating button in the bottom-right corner of the page:

![VuePoint FAB button](/images/fab-button.svg)

*The floating action button (FAB) is VuePoint's entry point. If you don't see it, ask a developer to confirm VuePoint is installed.*

## Step 2: Activate the Toolbar

Click the **floating action button** to expand the VuePoint toolbar. You can also press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> (or <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> on Mac) to toggle it.

![VuePoint toolbar expanded](/images/toolbar-expanded.svg)

*The expanded toolbar shows annotation controls and a panel for reviewing your annotations.*

### Toolbar Controls at a Glance

| Control | What It Does |
|---------|-------------|
| **Annotate** | Enter annotation mode — click any element to annotate it |
| **Copy All** | Copy all annotations as structured text for AI agents |
| **Clear** | Remove all annotations |
| **Pause Animations** | Freeze animations so you can annotate moving elements |
| **Dark/Light toggle** | Switch the toolbar theme to match your app |

## Step 3: Annotate an Element

1. Click the **Annotate** button in the toolbar (or press the keyboard shortcut)
2. Your cursor changes to a crosshair — move it over the page to see elements highlight as you hover
3. **Click the element** you want to give feedback on

![Highlighting an element](/images/element-highlight.svg)

*Elements highlight in blue as you hover over them in annotation mode.*

A feedback form appears:

![Feedback form](/images/feedback-form.svg)

4. Type your feedback in the **main text field** — describe the issue or suggestion
5. *(Optional)* Click **"Expected / Actual"** to expand additional fields:
   - **Expected behavior** — What should happen
   - **Actual behavior** — What is happening instead
6. Click **Submit**

A numbered badge appears on the element you annotated.

## Step 4: Review Your Annotations

The annotation panel (on the right side of the toolbar) shows all your annotations in a list:

![Annotation panel](/images/annotation-panel.svg)

*Each annotation shows a number, the element name, your feedback, and its status.*

From the panel you can:

- **Click an annotation** to scroll back to that element on the page
- **Double-click the feedback text** to edit it inline
- **Delete** an annotation using the trash icon

## Step 5: Copy and Send to an AI Agent

When you're done annotating, click the **"Copy All"** button. This copies all your annotations to your clipboard in a structured format that AI agents understand.

Then **paste** into any AI agent chat — Claude Code, Cursor, ChatGPT, or a Slack channel with an AI bot.

### What Gets Copied

Here's an example of what the AI agent receives:

```
## Annotation 1

**Element:** button.submit-btn "Save Changes"
**Selector:** .user-form > .actions > button.submit-btn
**Component:** <App> → <SettingsView> → <UserForm>
**SFC Path:** src/views/settings/UserForm.vue
**Route:** /settings/profile

**Feedback:** Button stays active during loading state
**Expected:** Button disabled + spinner while saving
**Actual:** Triggers duplicate API calls on double-click
```

::: info Why is this useful?
Unlike a screenshot or a Slack message saying "the button is broken," this output gives the agent the **exact file path**, **component name**, and **CSS selector** it needs to find and fix the code. What would take a developer minutes to locate takes the agent seconds.
:::

## Quick Copy

Sometimes you don't need the full annotation form — you just want to grab an element's context and paste it into a chat. While in annotation mode:

1. **Hover** over any element (it highlights in blue)
2. Press <kbd>⌘C</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>C</kbd>
3. A "Copied!" toast appears — the element's context is now on your clipboard

What gets copied:

```
<button> "Save Changes"
in <App> → <SettingsView> → <UserForm>
at src/views/settings/UserForm.vue
Selector: .user-form > .actions > button.submit-btn
```

This is ideal for quick bug reports or pasting context into an AI agent chat without creating a formal annotation.

## Additional Annotation Modes

Beyond clicking a single element, VuePoint supports three more ways to annotate:

### Multi-Select (Shift + Drag)

Hold <kbd>Shift</kbd> and drag to draw a rectangle. All elements inside the rectangle are captured as a single grouped annotation. Useful for flagging a group of related elements (e.g., "all these buttons should have the same style").

### Area Select (Alt + Drag)

Hold <kbd>Alt</kbd> (or <kbd>⌥ Option</kbd> on Mac) and drag to select an arbitrary area. This is useful for layout or spacing issues that don't map to a single element (e.g., "the gap between these sections is too large").

### Text Select

Select text on the page by clicking and dragging over it, then click **"Annotate Selection"** in the toolbar. This captures the selected text along with its location. Perfect for flagging typos, copy issues, or content changes.

## Tips and Best Practices

- **Be specific.** Instead of "this looks wrong," try "this button should be green, not blue" or "this text is cut off on smaller screens."
- **Use Expected/Actual for bugs.** If something is broken, fill in both fields. "Expected: form submits on Enter" / "Actual: nothing happens" gives the agent clear context.
- **Annotate one thing at a time.** Each annotation should describe one issue. Use multiple annotations for multiple issues — they'll all be included when you copy.
- **Include the route.** If you navigate to a specific page before annotating, the route is captured automatically. No need to describe where you are in the app.
- **Pause animations first.** If an element is animating or transitioning, click "Pause Animations" before annotating so you can click it precisely.

## FAQ

### Do I need to install anything?

No. VuePoint is already installed in the app by your development team. You just need to open the staging URL in your browser.

### Does this work on production?

No. VuePoint automatically disables itself in production environments. It only appears on development and staging URLs.

### What browsers are supported?

Chrome, Firefox, and Edge. Safari works but may have minor limitations with the screenshot feature.

### Can I annotate on mobile?

VuePoint is designed for desktop browsers. For mobile UI issues, use your desktop browser's responsive mode (press <kbd>F12</kbd>, then click the device toggle icon).

### What if I don't see the floating button?

- Make sure you're on a staging/development URL, not production
- Try pressing <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> — the button may be hidden behind other elements
- Ask a developer to confirm VuePoint is installed and enabled

### What happens after I paste my annotations?

The AI agent reads the structured data and can immediately locate the relevant code. Depending on your team's setup, the agent may:
- Fix the issue directly and open a pull request
- Ask clarifying questions (which appear back in the VuePoint toolbar)
- Acknowledge the annotation so you can see its status change

### Can multiple people annotate at the same time?

Yes. Each browser tab has its own annotation session. If your team has the bridge/API set up, annotations from all team members can be viewed on a shared dashboard.

### How do I know if the agent received my feedback?

If your team uses the MCP integration, annotations change status in real time:
- **Blue** — Pending (agent hasn't seen it yet)
- **Orange** — Acknowledged (agent is working on it)
- **Green** — Resolved (agent fixed it)

You'll see these status colors on the numbered badges and in the annotation panel.
