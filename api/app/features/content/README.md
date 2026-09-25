# content

## Purpose

The words Eventtz publishes and receives: the **blog** (staff write, anyone
reads), the **Help Center** (articles per portal plus an AI assistant grounded
in them) and the **contact forms** (clients, vendors and staff write to the team).

## Use cases

- As **staff**, I **draft, edit, publish, unpublish and delete blog posts** so
  that the public blog stays current. Every change is written to the audit log.
- As **anyone**, I **read the published blog feed and a post by its slug**.
- As a **client, vendor or staff member**, I **browse Help Center categories and
  articles for my portal** so that I can answer my own question.
- As a **client, vendor or staff member**, I **ask the help assistant a question**
  and get an answer grounded only in my portal's articles, with links to them.
- As a **client or vendor**, I **send the team a message**, optionally about one
  of my bookings, so that someone follows up.
- As **staff**, I **report a bug in the admin console**.

## Invariants

- Blog HTML is sanitised to an allow-list before it is stored
  (`domain_blog.sanitize_blog_html`); the golden `sanitize_blog_html.json` pins it.
- Blog slugs are unique: a taken slug gets `-2`, `-3`… (then a random suffix).
- Publishing keeps the first `published_at`; unpublishing keeps it too.
- Help audiences: clients see `client` + `both` articles, vendors `vendor` +
  `both`, staff see `admin` articles by default and may preview the others.
  Clients and vendors can never read another portal's articles.
- The assistant only ever cites slugs from the articles it was given, at most 6.
- A contact message is stored before anything else happens; the subject
  classifier, the automation webhook and the staff alert email can all fail
  without failing the submission.
- A contact message may only reference a booking the sender is a party to.

## Routes

| Method | Path | Who | Router |
|---|---|---|---|
| GET | `/blog/posts` | anyone | `router.py` |
| GET | `/blog/posts/{slug}` | anyone | `router.py` |
| GET | `/help/categories` | signed in | `router.py` |
| GET | `/help/articles` | signed in | `router.py` |
| GET | `/help/articles/{slug}` | signed in | `router.py` |
| POST | `/help/ask` | signed in | `router.py` |
| POST | `/client/contact` | client | `router.py` |
| POST | `/vendor/contact` | vendor | `router.py` |
| GET, POST | `/admin/blog/posts` | staff | `router_admin.py` |
| GET, PATCH, DELETE | `/admin/blog/posts/{post_id}` | staff | `router_admin.py` |
| POST | `/admin/blog/posts/{post_id}/publish` | staff | `router_admin.py` |
| POST | `/admin/blog/posts/{post_id}/unpublish` | staff | `router_admin.py` |
| POST | `/admin/contact` | staff | `router_admin.py` |
