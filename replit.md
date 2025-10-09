# Maltcha - KakaoTalk Conversation Analysis Application

## Overview

Maltcha is a web application designed to analyze KakaoTalk conversation exports using AI-powered insights. Users upload their chat history files, and the application processes these conversations to generate statistics, visualizations, and AI-driven insights related to communication patterns, sentiment, and participant behavior. The application aims to provide a modern, responsive interface for uploading files, tracking analysis progress, and displaying comprehensive AI-generated results, including relationship assessments, communication dynamics, emotional analysis, and actionable insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite, shadcn/ui (built on Radix UI and Tailwind CSS) for UI, Wouter for routing, and React Query for server state management.

**UI/UX Decisions**: The application features a custom color palette with primary green tones and supports dark mode. It includes a redesigned, hierarchical 2-level accordion system for relationship selection, replacing a flat button list. The results display is comprehensive, showing all AI analysis content.

**Data Visualization**: Recharts library is used for interactive charts (line, bar, area, pie) to visualize conversation metrics.

### Backend Architecture

**Runtime**: Node.js with TypeScript, using Express.js to serve API endpoints and static assets.

**AI Pipeline**: A five-stage AI pipeline processes conversations:
1.  **FBI Evidence Collector (Gemini 2.5 Flash)**: Filters messages into CRITICAL/MEDIUM/LOW categories based on an FBI CSI framework, handling Korean language nuances.
2.  **[Reserved]**: Placeholder for future implementation.
3.  **FBI Profiler (Gemini 2.5 Flash)**: Analyzes evidence metadata to create a relationship profile using a 6-stage profiling process, distinguishing MO from Signature and reconstructing timelines.
4.  **Relationship Therapist (Claude Sonnet 4.5)**: Provides psychological interpretation of patterns discovered by the FBI Profiler using a 6-stage clinical assessment framework, requiring message citations for all insights.
5.  **Relationship Coach "Tea" (Claude Sonnet 4.5)**: Converts FBI profiles and therapist analysis into practical, immediately actionable advice with specific conversation scripts, 3-week action plans, and expected outcomes.

**Asynchronous Processing**: Analysis operations run asynchronously, with the client polling for completion to handle long-running AI tasks without blocking.

**Error Handling**: Robust error handling is implemented for AI responses, rate limits, and data validation, ensuring analysis completion and preventing partial data persistence.

### Data Storage Solutions

**Hybrid Storage**: Utilizes in-memory storage (`MemStorage`) for temporary analysis results and a PostgreSQL database for persistent shareable links.

**Schema Design**: Zod schemas are used for runtime validation of messages and analysis results. Drizzle ORM schemas define database tables, specifically `shared_results` for shareable links, including unique IDs, 24-hour expiration, and view counting.

### Authentication and Authorization

The application currently operates without user authentication, designed for single-user, session-based analysis.

## External Dependencies

**AI Services**:
-   **Google Generative AI (Gemini API)**: Used for the initial filtering and summarization stage (`gemini-2.5-flash`).
-   **Anthropic (Claude API)**: Used for the deep analysis stage, generating comprehensive relationship insights (`claude-sonnet-4-20250514`).

**Database**: Neon serverless PostgreSQL, configured via `@neondatabase/serverless` adapter for shareable links.

**File Processing**: Server-side parsing of KakaoTalk export `.txt` files, supporting two common formats and handling Korean text encoding.

**Environment Variables**: `DATABASE_URL`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (or `ANTHROPIC_API_KEY_ENV_VAR`), `NODE_ENV`.

**Social Media Integration**: Open Graph tags and a dedicated OG image (`/og-image.jpg`) are used for consistent social media sharing previews.