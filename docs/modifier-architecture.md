# WSNexa — Menu Modifiers & Item Customization Architecture

> **Version:** 6.0.0 (Phase 6 Menu Modifiers)  
> **Status:** Active Specification  

---

## 1. Domain Model Hierarchy

WSNexa organizes item customization in a multi-tenant hierarchy:

`Business` $\rightarrow$ `Branch` $\rightarrow$ `Menu Item` $\rightarrow$ `Modifier Groups` $\rightarrow$ `Modifier Options`

### 2. Selection Rules & Invariants

1. **Selection Modes:**
   - `single`: Allows exactly one option selection (`max_selections = 1`). Displayed as radio buttons.
   - `multiple`: Allows multi-option selection (`min_selections` to `max_selections`). Displayed as checkboxes.
2. **Requirement Rules:**
   - `is_required = true` mandates `min_selections >= 1`.
3. **Database Integrity Triggers:**
   - `trg_check_modifier_group_item`: Guarantees modifier groups belong to the exact same business and branch as the target menu item, and blocks adding groups to archived items.
   - `trg_check_modifier_option_group`: Guarantees modifier options belong to the exact same business and branch as the modifier group, and blocks adding options to archived groups.
4. **Money Storage:**
   - Option additional prices are stored as non-negative integers (`additional_price_cents` BIGINT) using deterministic decimal string parsing (`parseDecimalToMinorUnits`).
5. **Soft Deletion & Relational Integrity:**
   - Modifier groups and options use soft deletion (`deleted_at TIMESTAMPTZ`). Archiving a group hides it from active configuration views while preserving historical order logs.
