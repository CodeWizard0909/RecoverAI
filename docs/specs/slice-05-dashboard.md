# Spec: Slice 05 - The UI Dashboard (The Demo)

## Objective
Build the "Wow Moment" frontend. A single-page dashboard that shows live failed transactions, recovery actions, and allows the user to trigger the AI pipeline with one click.

## System Bounds
- **In Scope**:
  - `src/app/page.tsx`: The main dashboard UI.
  - Integration of `shadcn/ui` components (Table, Card, Button, Badge).
  - Real-time or SWR polling of Supabase to update the UI instantly without refreshing.
  - A master "Simulate Pipeline" button to trigger the batch processor and execution layers.
- **Out of Scope**:
  - Authentication (Dashboard is public for the demo).
  - Pagination (We will just show the latest 50 rows).

## Inputs / Outputs
- **Inputs**: User clicking "Simulate AI Batch".
- **Outputs**: 
  - UI Table updates live.
  - Summary metric cards update (`Total Failed`, `Total Recovered`, `Success Rate`).

## UI Components
1. **Summary Cards**:
   - `Total At Risk` (Sum of failed payments)
   - `AI Actions Taken` (Count of executed actions)
   - `Money Recovered` (Sum of recovered payments)
2. **Action Bar**:
   - `Inject Mock Failure`: Calls our mock webhook to spawn a new row.
   - `Run AI Agent`: Calls the `/api/agent/process-batch` endpoint.
   - `Execute Recovery`: Calls the `/api/agent/execute` endpoint.
3. **Live Table**:
   - Columns: `Transaction ID`, `Amount`, `Failure Reason`, `AI Strategy`, `Status`.

## Edge Cases
- **Loading States**: Buttons must show a loading spinner while API requests are in flight to prevent double-clicking.
- **Empty State**: If no payments exist, show a friendly empty state prompting the user to "Inject Mock Failure".
