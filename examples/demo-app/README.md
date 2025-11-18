# Visual UAT Demo App

A simple web application for testing the visual-uat framework.

## Purpose

This demo app provides a real web application with multiple views and interactive elements to test visual-uat's:
- Screenshot capture at checkpoints
- Visual comparison between branches
- LLM-based evaluation of visual changes

## Features

### Three Views
1. **Home** - Welcome page with feature cards
2. **Contact Form** - Interactive form with validation
3. **Dashboard** - Stats grid and activity list

### Interactive Elements
- Navigation between views
- Form submission with API endpoint
- Styled components for visual testing

## Running the App

### Install Dependencies
```bash
cd examples/demo-app
npm install
```

### Start the Server
```bash
npm start
```

App will be available at `http://localhost:3000`

## Using with Visual UAT

### Example: Testing Button Color Change

1. **Create a test spec** (`tests/specs/button-test.md`):
```markdown
Navigate to home page
Checkpoint: home-initial
Click the Contact Form button
Checkpoint: form-view
```

2. **Make a visual change** (e.g., change button color in `styles.css`):
```css
.btn-primary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); /* Changed colors */
}
```

3. **Run visual-uat**:
```bash
npm run visual-uat run --base-branch main
```

Visual-uat will:
- Run tests in base branch (original colors)
- Run tests in current branch (new colors)
- Compare screenshots at each checkpoint
- Use LLM to evaluate if button color change is acceptable

## Testing Scenarios

### Scenario 1: Layout Change
Modify the grid layout in `.feature-grid` or `.stats-grid` and see visual-uat detect the difference.

### Scenario 2: Color Scheme
Change the gradient colors in `header` or `.stat-card` to test color change detection.

### Scenario 3: Typography
Modify font sizes or weights to test subtle visual changes.

### Scenario 4: Form Behavior
Test that form states (empty, filled, submitted) are captured correctly at different checkpoints.

## API Endpoints

- `GET /` - Serves the main application
- `POST /api/submit` - Handles form submission
- `GET /api/health` - Health check endpoint

## Modifying for Testing

The app is intentionally simple to make it easy to introduce controlled visual changes:

1. **CSS changes** - Modify `public/styles.css`
2. **Layout changes** - Modify `public/index.html`
3. **Behavior changes** - Modify `public/app.js`

Commit changes on different branches to test visual-uat's branch comparison.
