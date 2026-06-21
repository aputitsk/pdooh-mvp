# pDOOH MVP — Architecture

Version: 1.1

Status: Current MVP

---

# Purpose

This document describes the current application architecture and code organization.

---

# Project Structure

app/

- page.tsx
- advertiser/page.tsx
- advertisements/page.tsx
- screen/page.tsx

components/

- company/
- advertisements/
- auction/
- navbar/

lib/

- advertisements.ts
- mockWallet.ts
- walletEvents.ts
- walletStorage.ts
- walletTypes.ts

---

# Pages

Landing

Application entry.

Company Dashboard

Company onboarding and internal wallet management.

Advertisements

Create, view and delete advertisements.

Auction

Hidden bidding and live playback.

---

# Core Modules

Wallet Module

- Shared wallet state
- Navbar connection/logout
- Mock Arc-compatible implementation

Company Module

- Company creation
- Internal wallet
- Ready for Auction

Advertisements Module

- Advertisement storage
- Demo Advertisement
- Create / Delete
- Shared synchronization

Auction Module

- Hidden bidding
- Global auction engine
- Demo Bot
- Winner selection
- Payments

---

# State Management

Current MVP uses React state with localStorage synchronization.

Wallet changes are propagated through the Wallet Module.

Advertisements are managed through lib/advertisements.ts.

---

# Local Storage

Main keys

- pdooh-wallet-connected
- pdooh-company-name
- pdooh-company-created
- pdooh-balance
- pdooh-ads
- pdooh-demo-treasury
- pdooh-auction-*

---

# Architecture Principles

- Small reusable components.
- Pages orchestrate components.
- Shared business logic belongs in lib/.
- One responsibility per module.
- Keep architecture simple during MVP.

---

# Arc Preparation

Current architecture is designed so the mock implementation can later be replaced by Arc without changing the UI or user flow.

---

End of ARCHITECTURE.md
