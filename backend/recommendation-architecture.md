# EDOT Recommendation Architecture

## Goal

EDOT recommends the next best learning opportunities for each student using a multi-signal recommendation engine that combines goals, prior learning, performance, interests, and behavior patterns.

## Core inputs

- Learner goals from the profile
- Course and lesson history
- Quiz and progress performance
- Interests and skill strengths
- Weakness and feedback signals

## Recommendation pipeline

1. Signal collection
   - Gather profile data, progress metadata, and recent activity.
2. Feature extraction
   - Convert learner signals into weighted features such as skill affinity, momentum, and gap signals.
3. Scoring
   - Rank courses, lessons, skills, projects, and learning paths based on relevance and readiness.
4. Delivery
   - Show recommendations in the student dashboard and learning surfaces.
5. Feedback loop
   - Capture learner clicks, completions, and outcomes to improve future rankings.

## Why this supports AI improvement

The engine is structured so that future AI upgrades can learn from real behavior over time:

- Add reinforcement learning or bandit-style optimization on top of the scoring layer.
- Use outcome data to re-rank recommendations automatically.
- Personalize paths based on success patterns across similar learners.

## Example

If a student has strong signals for HTML, CSS, and JavaScript, the engine can prioritize:

- React
- Backend Development
- Full Stack Project
