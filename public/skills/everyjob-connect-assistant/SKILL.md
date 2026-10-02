---
name: everyjob-connect-assistant
description: "Connect a customer's AI assistant to their EveryJob account with a scoped agent key."
---

# EveryJob: Connect the Customer's Assistant

Give an AI assistant its own credential for a customer's EveryJob account, so it can search and propose on their behalf with the customer's identity resolved server-side.

## Workflow (human does this once)

1. The customer logs in at `https://kivo-nine-silk.vercel.app/customer/login`.
2. They open Profile → "Connect your AI assistant" → Generate key.
3. They copy the `ejc_agent_...` key and paste it into their assistant's configuration.
4. The assistant sends it as `Authorization: Bearer <key>` on EveryJob agent API calls.

## What the key grants

- Scopes: `read` (directory search) and/or `write` (propose quote requests). Read never implies write.
- With a key, the assistant OMITS customer contact fields — name, phone, email, city resolve from the account. Without a key, proposals require customerName + customerEmail.
- Keys are hashed at rest, shown once, revocable anytime from the same profile screen.

## Rules for assistants

- Store the key like a password. Never print it, never send it anywhere except EveryJob's API over HTTPS.
- If a call returns 401/403, tell the customer the key is invalid or lacks scope — don't retry blindly; ask them to regenerate it.
- A guest (no key, no account) can still receive a confirmation link and claim the request into a new account afterward.
