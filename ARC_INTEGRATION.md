# pDOOH — Arc Integration

Version: 1.1

Status: Planned

---

# Purpose

This document defines how the current mock MVP will be migrated to the Arc ecosystem.

The objective is to replace the implementation layer without changing the user experience.

The application flow, pages, components and UX must remain unchanged.

---

# Integration Principles

- Follow the official Arc documentation.
- Never invent SDK usage or APIs.
- Replace mock services one module at a time.
- Preserve the current application architecture.
- Keep the user experience unchanged.

---

# Current Mock Modules

Wallet Module

- mockWallet.ts
- walletStorage.ts
- walletEvents.ts
- walletTypes.ts

Advertisement Module

- advertisements.ts

Internal Wallet

- localStorage

Auction

- localStorage synchronization

---

# Arc Migration Order

## Phase 1

Replace Wallet Module.

Current

Mock Wallet

↓

Target

Arc Wallet

---

## Phase 2

Replace Internal Wallet.

Current

Mock Test USDC Balance

↓

Target

Arc Test USDC Balance

---

## Phase 3

Replace Advertisement Storage.

Current

localStorage

↓

Target

Arc-compatible persistent storage.

---

## Phase 4

Replace Auction Synchronization.

Current

localStorage

↓

Target

Arc infrastructure.

---

## Phase 5

Replace Payments.

Current

Mock balance updates

↓

Target

Real Test USDC transfers.

---

# Architecture Rules

Arc integration must not require redesigning pages.

The following pages should continue working without UX changes:

- Company Dashboard
- Advertisements
- Auction
- Live Screen

Only the implementation behind the modules should change.

---

# Wallet Rules

Navbar remains the only place where users connect or disconnect a wallet.

Company Dashboard never manages wallet connection.

Wallet Module remains the single source of truth.

---

# Advertisement Rules

Advertisements remain a dedicated module.

Business logic stays inside the Advertisement Module.

Company Dashboard only links to the Advertisements workspace.

---

# Development Rules

If Arc documentation changes:

1. Compare the new documentation with the current implementation.
2. Update this document if required.
3. Discuss architecture changes before implementation.
4. Only then modify the code.

The official Arc documentation always has priority.

---

End of ARC_INTEGRATION.md