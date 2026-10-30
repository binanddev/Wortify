# Temporary feature switches

Admin → Appearance → Bật / tắt tính năng. Only superusers can change switches.
Studio is always enabled. Existing deployments default to all features enabled.
Apply migrations before using the controls: `python Backend/manage.py migrate`.
No classroom, theme, or user data is deleted. Disabled saved interfaces render as
Studio without overwriting the saved choice. Clients refresh switches every 15
seconds and on window focus. Classroom APIs enforce the switch on every request,
including public boards and realtime tickets. Already-issued realtime tickets
are not revoked by this switch.

Implementation is isolated in `Backend/api/feature_availability.py` and
`Frontend/src/features/feature-availability.jsx`. The database model and migration
store only rollout configuration. Classroom dispatch checks before loading its
implementation. Public and authenticated classroom views use ClassGate.

To retire this mechanism, remove ClassGate wrappers and availability checks in
App.jsx and learning.jsx, remove FeatureSwitches from Admin.jsx, remove the
classroom dispatch check, and remove the two feature API routes. Then remove the
isolated feature modules and use a new Django migration to delete the
FeatureAvailability model (keep historical migrations). Classroom/theme code and
saved user preferences do not require rebuilding or restoring.
