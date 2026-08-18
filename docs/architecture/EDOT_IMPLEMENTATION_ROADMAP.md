# EDOT Implementation Roadmap

## Phase 1 — Product Foundation

### Goals

- stabilize the current platform
- prepare the codebase for an intelligent product architecture
- define the new domain structure

### Tasks

1. Refactor backend into domain-based modules
   - auth
   - users
   - courses
   - enrollments
   - learning
   - analytics
   - intelligence

2. Introduce a unified learning event pipeline
   - lesson viewed
   - quiz completed
   - assignment submitted
   - attendance marked
   - time spent learning

3. Create a new learner profile model
   - goals
   - interests
   - skill state
   - preference profile

4. Add analytics and event logging services

---

## Phase 2 — Intelligence Core MVP

### Goals

- bring the first AI-driven value to users

### Components

1. Student Learning Profile
   - create profile from learning behavior
   - update profile on each event

2. AI Mentor MVP
   - basic chat-based tutor
   - answer questions about course content
   - explain lesson concepts
   - suggest next steps

3. Recommendation Engine MVP
   - recommend next course or lesson
   - recommend exercises based on performance

4. Analytics Engine MVP
   - show progress and performance dashboard
   - detect low engagement or risk

---

## Phase 3 — Personalized Learning Experience

### Goals

- make the product feel adaptive and intelligent

### Features

- adaptive learning paths
- dynamic course recommendations
- personalized dashboards
- milestone-based progress views
- real-time nudges and reminders

---

## Phase 4 — Opportunity & Growth Layer

### Goals

- support learner growth beyond coursework

### Features

- career guidance suggestions
- scholarship or sponsorship recommendations
- mentor matching
- community recommendations
- opportunity-based learning paths

---

## Phase 5 — Enterprise Ready Product

### Goals

- make the platform global and scalable

### Features

- multi-tenant organization support
- admin intelligence dashboards
- cohort analytics
- integrations with external hiring, education, and content platforms

---

## Suggested First Development Sprint

### Sprint 1

- define and implement LearnerProfile model
- define learning event schema
- create analytics event collector
- build a simple AI mentor endpoint

### Sprint 2

- connect learner profile to course recommendations
- add personalized dashboard widgets
- create progress insight API

### Sprint 3

- add adaptive recommendations and feedback loops
- expose smart AI mentor responses in the frontend

---

## Recommended Architecture Decisions

1. Use Prisma for relational structures
2. Use PostgreSQL as the operational data store
3. Add a vector store later for semantic search and recommendation enrichment
4. Use a queue system for async AI processing
5. Keep the frontend modular by feature domain
6. Design APIs around learning intelligence rather than only CRUD
