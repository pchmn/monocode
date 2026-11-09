# User message bubble

User message bubbles get a tighter bottom-right corner, like a messaging tail, in both the chat and full-width transcript layouts; full-width bubbles also get 12px corners like chat. Border and width stay upstream's.

## Fork files
- `src/styles/userBubble.css` — unlayered override of the `.user-message-bubble` bottom-right radius

## Upstream hooks
- `src/main.tsx` — imports `userBubble.css`

## Verify
- Manual: send a short and a multi-line message in chat and full-width layouts; each bubble's bottom-right corner is sharper than the others.
