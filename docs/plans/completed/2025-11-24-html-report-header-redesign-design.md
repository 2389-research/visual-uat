# HTML Report Header Redesign - Design

**Date:** 2025-11-24
**Status:** Approved

## Overview

Redesign the HTML report header to provide clearer status visibility and more intuitive filtering. The current header has large clickable summary boxes that duplicate the filter functionality. The new design consolidates these into a cleaner status banner with enhanced filter buttons.

## Problem Statement

Current header issues:
1. Large summary boxes are both visual indicators AND clickable filters (confusing dual purpose)
2. Overall run status not clearly communicated at a glance
3. Filter buttons are plain and don't show data inline (e.g., count of tests)
4. No disabled state when filter would return 0 results
5. Metadata (branch, run ID) not prominently displayed

## Design Decision

Replace the large summary boxes with a two-row header:
1. **Status banner** (colored background) with run status + branch comparison + metadata
2. **Enhanced filter button group** with inline counts, colored styling, tooltips, and disabled states

## Header Structure

### Row 1: Combined Status Banner + Metadata

**Full-width colored banner** based on overall run status:
- **Green (#10b981):** All tests passed
- **Amber (#f59e0b):** Only passed + needs-review (no hard failures)
- **Red (#ef4444):** Any failed or errored tests

**Left side: Status + Branch Comparison**
- Icon + status text: "✓ All Tests Passed" / "⚠ 2 Tests Need Review" / "✗ Tests Failed"
- Branch comparison below: "Comparing: `feature/my-branch` → `main`" with arrow visual

**Right side: Metadata** (subtle/lighter styling within colored banner)
- Total tests count: "5 tests"
- Run ID (truncated, full ID in tooltip on hover)
- Timestamp

### Row 2: Filter Button Group

**Enhanced button group** replacing both old summary boxes and plain filter buttons:

**Button Layout:**
- Horizontal row of pill-shaped buttons
- Order: "All" → "Passed" → "Needs Review" → "Failed" → "Errored"
- Small gaps between buttons for visual separation

**Button Content:**
- Label + count in parentheses
- Examples: "All (5)", "Passed (2)", "Needs Review (1)", "Failed (1)", "Errored (0)"

**Color Scheme:**
- **All:** Neutral blue (#3b82f6)
- **Passed:** Green (#10b981)
- **Needs Review:** Amber/Yellow (#f59e0b)
- **Failed:** Red (#ef4444)
- **Errored:** Orange (#f97316) - distinct from disabled gray and yellow

**Visual States:**
1. **Active:** Full status color background, white text, subtle shadow/elevation
2. **Inactive:** Light tinted background (e.g., green-50), status color border, status color text
3. **Disabled (0 count):** Gray background (#e5e7eb), gray text (#9ca3af), reduced opacity, no hover, no pointer cursor

**Tooltips (HTML `title` attribute):**
- **"All" button:** Status breakdown with percentages
  - Example: "Passed: 2 (40%), Needs Review: 1 (20%), Failed: 1 (20%), Errored: 1 (20%)"
- **Status-specific buttons:** List of test names (max 4, ellipsis for more)
  - Example for "Failed": "login-page\ncheckout-flow\n...and 2 more"

**Search Box:**
- Remains on right side of filter bar
- Filters by test name
- Works with status filter (AND logic)

## What Stays the Same

**Test Cards:**
- Expandable card design unchanged
- Colored left border indicating status
- Auto-expand for "needs-review" and "failed"
- Click-to-expand/collapse behavior

**Image Comparison:**
- All three view modes (Overlay, Diff, Side-by-Side)
- Slider interaction for overlay mode
- Lazy loading

**Filtering Logic:**
- Status filter + search with AND logic
- Filtered cards get `.hidden` class
- Cards remain in DOM (not removed)

## Technical Implementation

**Code Structure:**
- Keep `HTMLReporter` class structure
- Keep method separation (`generateHTML`, `generateTestCard`, etc.)
- Add new methods:
  - `generateStatusBanner()`: Creates Row 1 with colored background
  - `generateFilterButtonGroup()`: Creates Row 2 with enhanced buttons
- Update `generateFilterScript()`:
  - Add disable logic based on test counts
  - Generate tooltip content dynamically
  - Update button state styling

**Data Requirements:**
- Same `RunResult` input structure
- Calculate overall run status from summary counts
- Build tooltip content from test arrays

**Styling Approach:**
- Inline CSS maintained (no external dependencies)
- Use existing color palette with orange addition
- Responsive design (flex-wrap for narrow screens)

## Success Criteria

1. Overall run status immediately visible from colored banner
2. Branch comparison clearly displayed
3. Filter buttons show counts inline
4. Disabled state prevents clicking empty filters
5. Tooltips provide detailed breakdowns
6. All existing functionality preserved (search, test cards, image comparison)
7. Visual regression testing via dogfooding catches any layout issues

## Future Enhancements

Not in scope for this redesign:
- Duration/performance metrics in header
- Filtering by multiple statuses (OR logic)
- Sorting options (by name, duration, status)
- Expandable metadata section
