# Flaglight Control Room

Build a complete, professional frontend UI for a project called **Distributed Feature Flag Management System**.

This is a college-level system design project demonstrating a low-latency distributed feature flag service.

IMPORTANT: Build ONLY the frontend. Do not create a new backend, database, authentication system, or replace existing APIs.

### Technology
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- Recharts for charts where useful

### Design direction
Create a premium developer-focused SaaS dashboard.

Visual style:
- Dark charcoal sidebar
- Clean light main workspace
- Subtle violet accent color
- Professional typography
- Minimal shadows and borders
- Consistent spacing
- Responsive layout
- Smooth but subtle interactions

Avoid generic landing pages, excessive gradients, oversized cards, and unnecessary animations.

### Sidebar navigation
1. Overview
2. Feature Flags
3. Evaluation Playground
4. Regions
5. Monitoring
6. API Documentation

### 1. Overview Dashboard
Display:
- Total feature flags
- Enabled flags
- Disabled flags
- Current environment
- Region A health
- Region B health
- Recent activity
- Request activity chart

Use clearly marked demo placeholders only until real API data is connected.

### 2. Feature Flag Management
Create a professional feature flags table with:
- Flag key
- Flag name
- Environment
- Enabled status
- Rollout percentage
- Last updated

Provide:
- Create flag dialog
- Edit flag dialog
- Enable/disable controls
- Search and filtering
- Delete confirmation dialog

Include fields for the actual supported flag properties, including key, name, description, enabled status, percentage, environment, and targeting rules.

### 3. Evaluation Playground
Create an interactive testing interface:
- Feature flag key input
- User identifier input, if supported
- Environment selector
- Evaluate button
- Result showing ENABLED or DISABLED
- Evaluation reason
- Region information

### 4. Multi-Region Management
Display two regions:
- Region A
- Region B

Show:
- Backend health
- Region endpoint
- Connectivity status
- Test connection action

Clearly distinguish between backend region health and Redis health.

### 5. Monitoring
Create monitoring visualizations for:
- Request volume
- Response latency
- Error rate
- Cache activity
- Service health

Do not fabricate live metrics. Clearly label unavailable metrics and demo data.

### 6. API Documentation
Create a clean endpoint reference page showing:
- HTTP method
- Endpoint
- Description
- Example request

### Integration preparation
Create a centralized API service layer.

Configure the default API base URL using:
http://localhost:8080

Known existing endpoints:
- GET /health
- POST /api/v1/feature-flags
- GET /api/v1/feature-flags/{flag_key}
- PATCH /api/v1/feature-flags/{flag_key}
- POST /api/v1/evaluate

Do not assume list or delete endpoints exist. Design the interface so those operations can be connected once the actual backend routes are verified.

Create reusable components and clean TypeScript types.

### Final requirement
Generate a complete, polished, responsive frontend with working navigation, dialogs, forms, tables, and interactive states.

Prioritize the quality of the dashboard UI and clean component architecture. Keep backend integration isolated so it can be connected to an existing FastAPI service later.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/be2b9297-89db-4752-befa-8cfb5eb637f9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
