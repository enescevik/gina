# GINA authentication emails

Production dashboard project: `gina-prod` (`wixjxlxgyhgdacadsawo`).

- Reset password: `reset.html`; subject from `subjects.json` → `reset`.
- Confirm sign up: `confirm.html`; subject from `subjects.json` → `confirm`.
- Both subject and body select English when `user_metadata.locale == "en"`; otherwise Turkish.
- Signup writes the resolved app locale before the confirmation message is sent. Signed-in, non-anonymous sessions sync it on app/language changes, except during password recovery.
- Logged-out reset requests use the account's saved locale, not the requesting browser's locale. Older clients/accounts without metadata use Turkish until a newer client syncs their preference.
- Only these two authentication templates are customized. Other auth/transactional messages are unchanged.
- Images are served from `https://ginafamily.com/email/v1/`, copied from `deploy/web/email` during the web build. Keep versioned image URLs available for old messages.
- Deploy the web assets before saving these templates and subjects in Supabase Authentication → Emails. Repository files alone do not update hosted Auth settings.
- Preserve `{{ .ConfirmationURL }}` for the existing PKCE callback and reset flows. No legal links or invented support mailbox.

Validation: mobile typecheck/lint; web build; public image checks; real confirmation delivery and callback test. Native clients require a subsequent app release for the new locale metadata behavior.
