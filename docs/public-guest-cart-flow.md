# Public Guest Cart User Flow

This document details the step-by-step guest interaction flow for Phase 9.

---

## Customer Flow Sequence

```
1. Scan Branch QR Code
   └─ Opens /m/[token] (Resolves Business & Branch metadata via RPC)

2. Optional Table Selection & Security PIN Verification
   └─ Guest selects Table Number & enters Table PIN if required by Branch settings.
   └─ Verified table context is stored in CartState as safe metadata (no PINs stored).

3. Browse Digital Menu
   └─ Scroll categories, search items, view prices in Branch currency.

4. Open Item Customization Sheet
   └─ Tap item to open accessible bottom sheet / modal.
   └─ Select single or multiple modifier options.
   └─ Choose quantity (1 to 99).
   └─ Add optional special instructions (max 250 characters).
   └─ View live line total calculation.

5. Add to Cart
   └─ Visual response < 50ms.
   └─ Floating mobile cart bar appears automatically at screen bottom.

6. Open Slide-Over Cart Drawer
   └─ Review table context status.
   └─ Increase/decrease item quantities.
   └─ Edit configured item (re-opens customization sheet with preloaded state).
   └─ Remove lines or clear cart.

7. Checkout Preview Route (/m/[token]/checkout)
   └─ Navigates to Phase 10 checkout preview.
   └─ Restores cart state from sessionStorage.
   └─ Displays Phase 10 Preview Banner: "Order placement will be completed in Phase 10."
   └─ Creates 0 database order records.
```
