/**
 * primevue-filter.ts
 *
 * Default list of PrimeVue internal component names to exclude from the
 * VuePoint hierarchy output. These are implementation details — showing
 * them in the chain adds noise without helping agents find your code.
 *
 * Users can replace or extend this list via the filterComponents option.
 * Set filterComponents: false to disable all filtering.
 */

export const PRIMEVUE_FILTER: string[] = [
  // Layout internals
  'PVVirtualScroller',
  'VirtualScroller',
  'PVOverlayEventBus',
  'PVPortal',
  'Portal',
  'Teleport',

  // Animation wrappers
  'PVTransition',
  'VueBaseTransition',

  // Icon wrappers
  'PVDynamicIcon',
  'SpinnerIcon',
  'CheckIcon',
  'TimesIcon',
  'ChevronDownIcon',
  'ChevronUpIcon',
  'ChevronRightIcon',
  'ChevronLeftIcon',
  'SearchIcon',
  'CalendarIcon',
  'EyeIcon',
  'EyeSlashIcon',
  'AngleDoubleLeftIcon',
  'AngleDoubleRightIcon',
  'AngleLeftIcon',
  'AngleRightIcon',
  'StarIcon',
  'StarFillIcon',
  'BanIcon',
  'BlankIcon',
  'ExclamationTriangleIcon',
  'InfoCircleIcon',
  'TimesCircleIcon',
  'CheckCircleIcon',

  // Misc internals
  'PVFocusTrap',
  'FocusTrap',
  'Ripple',
]

/**
 * Vue built-in names that should always be filtered regardless of config.
 */
export const VUE_BUILTINS: string[] = [
  'Transition',
  'TransitionGroup',
  'KeepAlive',
  'Suspense',
  'Teleport',
  'Fragment',
  'Comment',
  'Text',
  // Composition internals
  'RouterView',
  'RouterLink',
]

export function buildFilter(option: string[] | false | undefined): Set<string> {
  if (option === false) return new Set()
  if (Array.isArray(option)) return new Set([...VUE_BUILTINS, ...option])
  return new Set([...VUE_BUILTINS, ...PRIMEVUE_FILTER])
}
