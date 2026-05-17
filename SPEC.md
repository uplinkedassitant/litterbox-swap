# Litterbox — Batch Swap Wizard

Swap multiple SPL tokens in your wallet to a PumpFun token in one flow.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Wallet:** `@solana/wallet-adapter` (Phantom, Solflare, Backpack, etc.)
- **Swap API:** Jupiter Swap API V2 (`/swap/v2/order` + `/swap/v2/execute`)
- **Token Mint:** PumpFun (created during wizard, token address set before swaps)
- **Target:** Any SPL token with Jupiter liquidity → the PumpFun token

## Architecture

### No backend required
- All logic client-side
- Jupiter API handles routing, execution, and transaction landing
- Wallet signs each swap transaction

## User Flow (4-Step Wizard)

### Step 1 — Connect Wallet
- Show supported wallets (Phantom, Solflare, Backpack, etc.)
- Once connected, show wallet address (truncated) + SOL balance
- "Continue" button activates

### Step 2 — Select Tokens
- Fetch user's token balances via Jupiter Portfolio API
- Display as grid of cards: icon, symbol, balance
- Each card has a checkbox to select/deselect
- Filter/search bar at top
- "Select All" / "Clear" shortcuts
- Skip tokens with 0 balance
- Show count of selected tokens
- "Continue" button (disabled until ≥1 selected)

### Step 3 — Pick Target Token
- Search bar to find the PumpFun token
- Option to paste a known token mint address
- Shows token icon, symbol, name once selected
- "Continue" button (disabled until target selected)

### Step 4 — Review & Execute
- Summary: "Swap X tokens → $SYMBOL"
- Per-token breakdown: icon, symbol, estimated output amount
- Total estimated output in target token
- Slippage tolerance selector (0.5%, 1%, 3%, custom)
- "Execute Swaps" button — triggers sequential swaps
- Progress view: "Swapping USDC... Done" per token
- Failed swaps shown with error, continue to next
- Final summary: X succeeded, Y failed

## API Integration

### Jupiter Swap V2 (Meta-Aggregator)
```
GET https://api.jup.ag/swap/v2/order
  ?inputMint={tokenMint}
  &outputMint={targetMint}
  &amount={lamports}
  &slippageBps={bps}
  &wallet={walletAddress}
  &priorityFeeUsd=0.001

POST https://api.jup.ag/swap/v2/execute
  Body: { orderId: string }
```

### Jupiter Portfolio API
```
GET https://api.jup.ag/portfolio/v1/positions?wallet={address}
```

### Jupiter Price API
```
GET https://api.jup.ag/price/v3?ids={mints}
```

## File Structure

```
litterbox/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Wallet provider wrappers
│   │   ├── page.tsx            # Wizard container
│   │   ├── globals.css
│   │   └── components/
│   │       ├── Wizard.tsx           # Step nav + routing
│   │       ├── StepConnect.tsx      # Step 1: Connect wallet
│   │       ├── StepSelectTokens.tsx # Step 2: Token grid
│   │       ├── StepPickTarget.tsx    # Step 3: Target token
│   │       ├── StepReview.tsx       # Step 4: Review + execute
│   │       ├── TokenCard.tsx        # Token display card
│   │       └── ProgressBar.tsx      # Swap execution progress
│   ├── lib/
│   │   ├── jupiter.ts              # Jupiter API client
│   │   ├── wallet.ts              # Wallet helpers
│   │   └── utils.ts               # Formatting, etc.
│   └── types/
│       └── index.ts
├── SPEC.md
└── package.json
```

## Key Decisions

- **Sequential over atomic:** Each swap is independent, one failure doesn't tank the batch
- **Portfolio API for balances:** Clean, no RPC needed
- **Per-swap signing:** User signs each swap separately — keeps it simple and secure
- **No on-chain program:** Pure REST API + Jupiter infrastructure

## Environment Variables

```
NEXT_PUBLIC_JUP_API_KEY=    # Optional: Jupiter API key (keyless works without)
NEXT_PUBLIC_RPC_URL=         # Optional: Custom RPC (falls back to public)
```

## Future Phases

- Phase 2: Bundle swaps (2-3 per tx) for efficiency
- Phase 2: Save favorites / recent targets
- Phase 3: PumpFun token creation inline in the wizard