# EDOT Intelligence Architecture

## 1. Product Vision

EDOT is being redesigned from a traditional learning management system into an intelligent education ecosystem.

The new vision is:

> An intelligent education ecosystem that understands learners, teaches them, builds their skills, connects them with opportunities, and helps them achieve their goals.

This means EDOT will not only host courses. It will act as a smart growth platform that continuously learns from each learner’s behavior, performance, preferences, and goals.

---

## 2. Product Transformation Summary

### Current EDOT state

The current EDOT platform already has strong foundations:

- course management
- student enrollment
- instructor dashboards
- admin controls
- parent and sponsor workflows
- messaging and live class support
- reporting and analytics

### Target EDOT state

The redesigned EDOT will evolve into:

- a personalized learning operating system
- an AI mentor-driven education experience
- a skill intelligence platform
- a recommendation engine for learning paths and opportunities
- a scalable product for global learners and institutions

---

## 3. Core Product Principles

The architecture is built around five principles:

1. Intelligence first
   - Every major system should learn from user behavior.

2. Personalization at the core
   - Learning must adapt to each learner’s profile, pace, goals, and gaps.

3. Modular architecture
   - AI systems must be independent services that can grow and be replaced.

4. Premium experience
   - The product must feel like a modern global startup platform, not a university project.

5. Future-ready AI expansion
   - The platform must support future features like copilots, tutoring agents, career matching, and skill forecasting.

---

## 4. The Intelligence Core

The Intelligence Core is the heart of EDOT. It is composed of five platforms:

### 4.1 Student Learning Profile

Purpose:

- Build a dynamic understanding of each learner.
- Track skills, interests, strengths, weaknesses, learning pace, preferences, and goals.

Responsibilities:

- collect learner data from courses, quizzes, activity, attendance, and behavior
- create a skill graph for each learner
- maintain learning preferences and motivation signals
- produce a continuously updated learner profile

Key outputs:

- learning readiness
- skill mastery level
- confidence score
- engagement profile
- recommended next actions

### 4.2 AI Mentor

Purpose:

- act as a real-time intelligent tutor and coach.
- guide the learner through their learning journey.

Responsibilities:

- answer learner questions
- explain concepts simply
- suggest study plans
- provide motivation and learning nudges
- recommend exercises and content
- adapt tone and difficulty based on learner profile

Key outputs:

- study guidance
- instant explanations
- adaptive coaching
- personalized feedback

### 4.3 Course Intelligence Engine

Purpose:

- make courses adaptive and smart.
- analyze how each course performs and how learners interact with it.

Responsibilities:

- evaluate lesson difficulty and learner drop-off
- detect weak topic areas
- recommend lesson sequencing
- identify content gaps and quality issues
- suggest improvements for course design

Key outputs:

- adaptive learning paths
- content quality insights
- course effectiveness scores
- personalized lesson flow

### 4.4 Learning Analytics Engine

Purpose:

- turn raw learning activity into strategic insight.

Responsibilities:

- measure progress, attendance, quiz performance, consistency, and engagement
- detect at-risk learners
- identify growth opportunities
- provide dashboards for admins, instructors, and learners

Key outputs:

- learner progress analytics
- retention insights
- risk alerts
- performance dashboards

### 4.5 Personalized Recommendation Engine

Purpose:

- recommend the right content, course, mentor action, or opportunity at the right time.

Responsibilities:

- recommend next courses
- recommend learning paths
- recommend exercises, resources, and mentors
- connect learners with opportunities such as scholarships, internships, gigs, or community support

Key outputs:

- next best action
- personalized learning roadmap
- opportunity matching

---

## 5. System Architecture Overview

The platform will be organized into layers:

### Presentation Layer

- web app
- mobile-ready responsive interface
- dashboard experiences for learners, instructors, admins, sponsors, and parents

### Application Layer

- auth and identity service
- course service
- enrollment service
- learning progress service
- recommendation service
- mentor service
- analytics service
- notification service

### Intelligence Layer

- Student Learning Profile service
- AI Mentor service
- Course Intelligence Engine
- Learning Analytics Engine
- Recommendation Engine
- AI orchestration layer

### Data Layer

- PostgreSQL for relational data
- vector database or semantic store for embeddings and similarity search
- object storage for media assets
- event store or analytics warehouse for learning events

### Integration Layer

- OpenAI / Gemini / Azure AI / local LLM services
- Cloudinary / object storage
- email and notification providers
- live class providers
- payment and sponsorship integrations

---

## 6. High-Level Technical Architecture

```text
Users / Clients
   │
   ▼
Frontend App (React + Vite)
   │
   ▼
API Gateway / Backend Services (Express + Node.js)
   │
   ├── Auth & Identity
   ├── Course & Enrollment
   ├── Progress & Learning Events
   ├── AI Mentor
   ├── Recommendation Engine
   ├── Analytics Engine
   └── Notification / Messaging
   │
   ├── Intelligence Core
   │    ├── Student Learning Profile
   │    ├── Course Intelligence Engine
   │    ├── Learning Analytics Engine
   │    └── Personalized Recommendation Engine
   │
   ├── Data Stores
   │    ├── PostgreSQL
   │    ├── Vector Store
   │    └── Object Storage
   │
   └── External AI / Media / Communication Services
```

---

## 7. Proposed Backend Module Structure

The backend should be organized by business domain rather than by file type.

```text
backend/
  src/
    app/
      server.js
      routes.js
      middleware/
      error-handler/
    auth/
    users/
    courses/
    enrollments/
    learning/
    progress/
    analytics/
    intelligence/
      profile/
      mentor/
      course-intelligence/
      recommendations/
      analytics/
    notifications/
    integrations/
    shared/
      prisma/
      utils/
      validators/
```

---

## 8. Proposed Frontend Module Structure

```text
frontend/
  src/
    app/
      router/
      providers/
      layouts/
    features/
      auth/
      dashboard/
      learning/
      courses/
      mentor/
      analytics/
      recommendations/
      community/
    shared/
      components/
      hooks/
      services/
      ui/
      styles/
```

This structure keeps the product scalable and easy to expand as AI features grow.

---

## 9. Core Data Models

### User

- id
- name
- email
- role
- profile status
- preferences
- createdAt

### LearnerProfile

- userId
- goals
- interests
- skillGraph
- preferredLearningStyle
- motivationScore
- riskLevel
- lastActiveAt

### SkillNode

- id
- title
- category
- proficiencyLevel
- confidenceScore
- masteredAt

### LearningEvent

- userId
- eventType
- courseId
- lessonId
- timestamp
- score
- duration
- context

### CourseIntelligenceSnapshot

- courseId
- difficultyScore
- completionRate
- dropoutPoints
- engagementScore
- contentGapAnalysis

### RecommendationResult

- userId
- recommendationType
- targetId
- reason
- priority
- createdAt

### MentorSession

- userId
- sessionType
- prompt
- response
- feedbackScore
- contextSummary

---

## 10. API Design Direction

### Core APIs

#### Authentication

- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- GET /auth/me

#### Courses

- GET /courses
- GET /courses/:id
- POST /courses
- PUT /courses/:id
- POST /courses/:id/enroll

#### Learning Progress

- GET /learning/progress/:userId
- POST /learning/events
- GET /learning/path/:userId

#### Intelligence Core

- GET /intelligence/profile/:userId
- POST /intelligence/mentor/chat
- GET /intelligence/recommendations/:userId
- GET /intelligence/analytics/:userId
- POST /intelligence/course-insights/:courseId

#### Admin / Insights

- GET /admin/analytics/overview
- GET /admin/learners/at-risk
- GET /admin/recommendations/performance

---

## 11. UX Vision for the New EDOT

The product experience should feel like:

- a modern AI-native learning platform
- a premium education assistant
- a skills growth environment with clear progress and momentum
- an intuitive, personalized experience for every user

### Key UX experiences

- personalized dashboard
- AI mentor chat experience
- adaptive learning roadmap
- smart course recommendations
- progress-based milestone celebrations
- opportunity and career guidance panels

---

## 12. Scalability and Architecture Strategy

### Scalability approach

- modular services for independent scaling
- asynchronous event processing for analytics and recommendations
- background jobs for AI inference and insights generation
- caching for repeated queries and recommendations
- rate limiting and request throttling for AI endpoints

### Reliability approach

- clear service boundaries
- robust logging and monitoring
- retries for AI integrations
- graceful degradation when AI services are unavailable

### Security approach

- JWT and refresh tokens
- role-based access control
- encrypted storage for sensitive learner data
- privacy-conscious AI usage
- audit logs for instructor/admin actions

---

## 13. Recommended Implementation Phases

### Phase 1 - Foundation

- stabilize current platform
- refactor auth, courses, progress, and user models
- create clean domain-based backend structure
- define the Intelligence Core contracts

### Phase 2 - Intelligence Core MVP

- implement Student Learning Profile
- implement AI Mentor with basic chat coaching
- build recommendation engine for next-best-content
- create progress analytics endpoint

### Phase 3 - Adaptive Learning Experience

- make courses more adaptive
- add personalized dashboards
- create skill graph and learner journey views
- add milestone and growth signals

### Phase 4 - Growth and Opportunity Layer

- connect learners to scholarships, mentors, careers, and opportunities
- expand AI assistant into a full learning companion
- introduce premium insights and enterprise dashboards

---

## 14. Recommended Tech Stack for the New Vision

### Frontend

- React 19
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Framer Motion
- Recharts
- Socket.IO client

### Backend

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- Socket.IO
- JWT
- Redis (recommended for caching and queues)
- BullMQ or similar job queue (recommended)

### AI Layer

- OpenAI or Gemini API
- embeddings store
- prompt orchestration service
- vector similarity search

### Infra / DevOps

- Docker
- environment-based deployment
- monitoring and logging tools
- CI/CD pipeline

---

## 15. What Should Be Built First

The first implementation should focus on:

1. Student Learning Profile
2. Learning event tracking
3. AI Mentor MVP
4. Personalized recommendations
5. Analytics dashboards

These five components will immediately create user value and establish the foundation for future expansion. 

---

## 16. Final Product Positioning

EDOT should be positioned as:

- an AI-powered learning ecosystem
- a personalized education platform
- a skill-growth engine for modern learners
- a global EdTech product with strong intelligence and product design

The goal is not just to deliver courses. The goal is to build an intelligent system that helps learners grow faster, smarter, and with more confidence.
