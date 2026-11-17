<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Platform editorial items live in `platform_content` with public published reads and admin-role-only writes, so media sections remain editable without redeploying.
- Homepage support contacts read the singleton `support_contact_settings` with public reads and role-protected admin writes; contact edits never change verified outgoing email senders.
- YouTube URLs are parsed into privacy-enhanced embeds and hosted media URLs are validated before rendering, so arbitrary content cannot inject an unsafe iframe.
- App emails go through src/lib/mailer.server.ts selected by EMAIL_PROVIDER (lovable default, smtp/resend/sendgrid/brevo/mailgun); keeps email working when self-hosted.
- Rebranding changes display text and document names, not storage keys, account IDs, asset paths, payment references, or verified sender domains, to preserve existing accounts and integrations.
- Homepage visual tokens and scoped styles use the `home-` prefix, so landing-page redesigns do not change account or admin surfaces.
- Homepage purchase amounts and entry banners share the stock minimum reader with live updates and polling, so they display the admin's current `stock_settings.min_total` instead of fixed example amounts.
- Homepage YouTube sections reuse `youtubeEmbed` and mount privacy-enhanced players on demand, so video handling stays consistent and the first page load stays lightweight.
- Login and registration share AuthShell and scoped `auth-` styling, so visual updates stay consistent without changing account submission behavior or other surfaces.
- Account tools use one shared toolbar at every screen size, with viewport-bounded mobile notifications, so phone users retain the desktop actions without clipped panels.
- Per-user share limits use `user_trading_limits`, locked database settlement checks and approved-withdrawal reset triggers; browser summaries only preview the authoritative rule, preventing concurrent or direct-write bypasses.
- Investment maturity uses one bounded SQL-only job; owner-only claims lock the account and investment and credit the stored total return once, while timestamp-based controls remain usable between job runs.
- Admin investment settlements use a role-checked RPC with the same profile-first locks and claimed fields as owner claims, so early completion and user claims cannot credit an investment twice; the settling admin is recorded.
- Withdrawal summaries share one owner/admin dialog; admin edits use a role-checked, version-checked SQL function with profile-first locks, balance-delta adjustments, immutable settled payment details, and an admin-only change log, so corrections cannot desynchronize balances or erase settlement history.
- Live support shares one attachment composer and viewer; private files are scoped by conversation and sender with validated metadata, immutable messages, short-lived image links, and authenticated downloads, so only the user and support admins can retrieve them.
- Stock logos use a CDN-hosted, source-documented ticker catalogue shared across trading and admin views; admin replacements take priority and retired favicon services are skipped to keep logos reliable.
- Admin lock-amount controls reuse the role-checked lock settings RPC while preserving rate and duration; the lock page polls settings and the existing settlement RPC enforces the saved limits.
- Share-sale previews use the shared cost-basis quote helper; SQL settles rounded total principal plus profit independently of browser prices, so displayed and credited proceeds agree.
- Portfolio sell reminders start only after owned holdings load and cancel on leaving the page; timers do not claim market-price movement.
- Admin account edits verify protected roles server-side before loading the auth admin client; synchronize profile contacts and auth metadata, preserve account IDs/balances/roles, and change write-only passwords last to avoid partial credential changes.
