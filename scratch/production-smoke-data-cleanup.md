# WSNexa Phase 35 — Optional Production Smoke Data Cleanup Guidance

> [!NOTE]
> Do NOT execute destructive cleanup automatically in production migrations.
> The following SQL statements can be run manually by a database administrator if test/smoke records need to be cleared.

## 1. Optional SQL to Purge Test Waitlist Entries
```sql
DELETE FROM public.reservation_waitlist_entries
WHERE guest_name IN ('Jane Doe (Staff Test)', 'Walk-In Guest', 'Test Waitlist Guest')
   OR notes LIKE '%smoke%';
```

## 2. Optional SQL to Purge Test Table Assignments
```sql
DELETE FROM public.reservation_table_assignments
WHERE reservation_id IN (
  SELECT id FROM public.reservations
  WHERE confirmation_code LIKE 'RSV-TEST%'
     OR guest_name IN ('Jane Doe (Staff Test)', 'Walk-In Guest')
);
```

## 3. Optional SQL to Purge Test Reservations
```sql
DELETE FROM public.reservations
WHERE confirmation_code LIKE 'RSV-TEST%'
   OR guest_name IN ('Jane Doe (Staff Test)', 'Walk-In Guest');
```

## 4. Optional SQL to Purge Test Notification Outbox Records
```sql
DELETE FROM public.reservation_notification_outbox
WHERE recipient_name IN ('Jane Doe (Staff Test)', 'Walk-In Guest');
```
