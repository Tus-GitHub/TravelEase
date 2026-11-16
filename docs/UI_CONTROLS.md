# Shared interaction controls

The public site, booking flow, account, driver and admin screens share the navy/amber
control design. `Button` provides primary, secondary, destructive, busy and disabled
states. Action buttons default to `type="button"`; submit/reset actions opt in.
Disabled link buttons do not navigate. Compact action targets use at least44px;
calendar cells retain their compact seven-column layout.

`src/components/controls/Select.tsx` replaces visible browser dropdowns. It retains
native form names, validation, controlled/uncontrolled values and change events via
a hidden bridge. The visible combobox supports arrows, Home/End, typeahead, Escape,
disabled options and search for long lists. Menus use the browser's top layer to
stay above scrolling and nested admin dialogs. Cancelling a menu does not submit
the enclosing form or change a saved value.

`DateInput.tsx` provides custom date/time calendars and preserves date-only or local
datetime strings. Existing Friday-editor IST conversion and the booking-specific
future-time rules remain at their current call sites. Dynamic CMS text/number fields
retain their ordinary input behavior. Checkboxes, radios, sliders and disclosure
arrows have custom styling while keeping native keyboard semantics.

The audit began with286 button declarations and55 visible native dropdowns. Source
coverage is distinct from live interaction coverage: destructive and financial
actions must only be exercised with owned test records. Do not click real customer
status, payment, deletion or supplier actions merely to inspect styling.

Release verification covers both Chrome and WebKit,320/390/768/1440px, light/dark,
required and disabled fields, real form values/reset, nested dialogs and keyboard
focus; actual package/admin/booking/shared-editor journeys; and production read-only
route/dialog checks plus owned car/package booking fixtures. No external UI service,
new dependency, database migration or paid feature is needed.
