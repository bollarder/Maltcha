# Maltcha - KakaoTalk Conversation Analysis Application

## Overview

Maltcha is a web application that analyzes KakaoTalk conversation exports using AI-powered insights. Users upload their KakaoTalk chat history (.txt files), and the application processes the conversations to generate statistics, visualizations, and AI-driven insights about communication patterns, sentiment, and participant behavior.

The application features a modern, responsive interface with a landing page, file upload system, real-time progress tracking, and comprehensive results display showing all Claude AI analysis including relationship assessment, communication patterns, emotional dynamics, and actionable insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### 2025-01-08: Gemini + Claude Pipeline Restoration
- **Pipeline Architecture**: Restored original Gemini (filtering) → Claude (deep analysis) two-stage pipeline
  - **Gemini Stage**: Filters messages by importance (HIGH 7%, MEDIUM 13%, LOW 80%) in 2,000-message batches, then generates timeline/turning point summary
  - **Claude Stage**: Performs deep analysis on filtered HIGH messages + MEDIUM samples using structured input package
  - **Token Optimization**: Reduces Claude input tokens significantly, preventing 30k tokens/minute rate limit errors
  - **Fallback Logic**: Automatically falls back to Claude-only mode if GEMINI_API_KEY is missing or Gemini pipeline fails
- **Error Handling**: Robust validation and error recovery
  - Validates Gemini responses (high_indices, medium_sample arrays)
  - Filters invalid message indices before Claude processing
  - Null guards on Claude practicalAdvice arrays to prevent .join() errors
  - Ensures analysis never gets stuck in "processing" state
- **Storage Updates**: Deferred stats/charts updates to final stage to prevent partial data persistence on pipeline failure

### 2025-01-08: UI/UX Improvements
- **Feedback Popup**: Changed scroll threshold from 80% to 95% for better user experience
- **Relationship Selection UI**: Redesigned from flat 8-button list to hierarchical 2-level accordion system
  - **6 Main Categories**: 가족 및 연인, 친구, 직장 및 학업, 사회적 관계, 공적 관계, 기타
  - **Subcategories**: Each category expands to show specific relationship types
  - **Direct Input**: "기타 > 직접 입력" option allows custom relationship entry
  - **Visual Design**: Smooth accordion animations, highlighted selections, responsive mobile layout
  - **Single Selection**: Changed from multi-select to single relationship selection
- **Comprehensive Analysis Display**: Results page shows all Claude AI analysis content
  - **Multi-turn Analysis**: Turn 1 (relationship assessment, key events, strengths, warnings) and Turn 2 (communication style, emotional dynamics, patterns, partner status)
  - **4-Stage Analysis** (fallback): Deep analysis with communication style, emotional expression, relationship dynamics, special patterns
  - **AI Insights**: Actionable recommendations based on conversation analysis
- **Data Flow**: Relationship type and user purpose properly propagate through analysis pipeline to results

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server.

**UI Framework**: shadcn/ui component library built on Radix UI primitives, styled with Tailwind CSS. The design system uses a custom color palette with primary green tones and supports dark mode.

**Routing**: Client-side routing implemented with Wouter, a lightweight alternative to React Router. The application has five main routes:
- `/` - Landing page with feature showcase
- `/upload` - File upload interface
- `/loading/:id` - Progress tracking during analysis
- `/results/:id` - Results display with charts and insights
- `/result/:shareId` - Shared results page for viewing analysis via share link

**State Management**: React Query (@tanstack/react-query) for server state management, API caching, and automatic refetching. Local component state managed with React hooks.

**Data Visualization**: Recharts library for rendering interactive charts including line charts, bar charts, area charts, and pie charts to visualize conversation metrics.

**Form Handling**: React Hook Form with Zod for schema validation, though primarily used implicitly through the shadcn/ui components.

### Backend Architecture

**Runtime**: Node.js with TypeScript, using tsx for development execution and esbuild for production builds.

**Framework**: Express.js serving both the API endpoints and static frontend assets in production.

**Development Server**: Vite middleware integrated with Express for hot module replacement during development, enabling seamless full-stack development experience.

**API Design**: RESTful endpoints following a simple pattern:
- `POST /api/analyze` - Initiates conversation analysis
- `GET /api/analysis/:id` - Retrieves analysis results
- `POST /api/share/:analysisId` - Creates a shareable link for an analysis (24-hour expiration)
- `GET /api/share/:shareId` - Retrieves shared analysis data

**Async Processing**: Analysis operations run asynchronously after returning an initial response. The client polls for completion status, allowing the server to handle long-running AI operations without blocking.

**Error Handling**: Centralized error handling with appropriate HTTP status codes. Validation errors return 400, not-found errors return 404, expired shares return 410, and server errors return 500.

### Data Storage Solutions

**Hybrid Implementation**: The application uses both in-memory storage and PostgreSQL database:
- **In-memory storage** (`MemStorage` class) for analysis results - suitable for temporary data that doesn't need persistence
- **PostgreSQL database** for shareable links - ensures cross-user sharing and 24-hour expiration tracking

**Storage Interface**: Well-defined `IStorage` interface that abstracts storage operations, making it straightforward to swap implementations. The interface supports:
- Creating analysis records
- Retrieving analysis by ID
- Updating analysis with results

**Schema Design**: The application uses two schema systems:

1. **Zod schemas** for runtime validation:
   - `Message`: Individual chat messages with timestamp, participant, and content
   - `AnalysisResult`: Complete analysis including metadata, processing status, parsed messages, statistics, chart data, and AI insights
   - `InsertAnalysis`: Input schema for creating new analyses

2. **Drizzle ORM schemas** for database tables:
   - `shared_results`: Stores shareable analysis links with nanoid-generated IDs, analysis data (JSON), creation timestamp, 24-hour expiration timestamp, and view count tracking

**Share Link System**: Implemented using PostgreSQL with the following features:
- **Unique IDs**: Generated using nanoid(10) for short, URL-friendly identifiers
- **24-hour expiration**: Automatically tracked via `expiresAt` timestamp; expired links return HTTP 410
- **View counting**: Tracks how many times a shared link has been viewed
- **Full analysis storage**: Stores complete analysis data as JSON for independent sharing
- **Error handling**: Distinguishes between not found (404) and expired (410) states

### Authentication and Authorization

**Current State**: No authentication implemented. The application is designed for single-user, session-based usage where users analyze their own conversation files.

**Session Management**: Uses `connect-pg-simple` for PostgreSQL-backed sessions (configured but may not be actively used with in-memory storage).

**Future Considerations**: The architecture could support user authentication to enable:
- Saving analysis history per user
- Sharing analysis results
- Rate limiting per user

### External Dependencies

**AI Services**: 
- **Gemini API** (Google Generative AI): First-stage filtering and summarization
  - Filters messages by importance (HIGH/MEDIUM/LOW) in 2,000-message batches
  - Generates timeline events, turning points, and relationship health summary
  - Model: `gemini-1.5-pro`
  - Fallback: If GEMINI_API_KEY missing, skips to Claude-only mode
  
- **Claude API** (Anthropic): Second-stage deep analysis
  - Uses filtered messages and Gemini summary for context-aware analysis
  - Generates comprehensive relationship insights, communication patterns, and actionable advice
  - Model: `claude-sonnet-4-20250514`
  - Rate limiting: 15s delays for 4-stage analysis, 30s for multi-turn to prevent 30k tokens/minute errors

**Database**: Neon serverless PostgreSQL (configured via `@neondatabase/serverless` adapter). Currently set up but not actively used due to in-memory storage implementation. Required environment variable: `DATABASE_URL`.

**File Processing**: Server-side parsing of KakaoTalk export files. Supports two common KakaoTalk export formats:
- `[Name] [Time] Message` format
- `2024. 1. 15. 오후 9:30, Name : Message` format

The parser extracts timestamps, participant names, and message content, handling Korean text encoding properly.

**Environment Variables**: 
- `DATABASE_URL` - PostgreSQL connection string (required by Drizzle config)
- `GEMINI_API_KEY` - Google Generative AI API key (optional, enables Gemini + Claude pipeline; falls back to Claude-only if missing)
- `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY_ENV_VAR` - Anthropic API credentials (required)
- `NODE_ENV` - Environment mode (development/production)

**Development Tools**:
- Replit-specific plugins for error overlays, cartographer, and dev banner (only in Replit environment)
- TypeScript for type safety across the entire stack
- ESLint and Prettier for code quality (implied by project structure)

**Chart Generation**: Statistics calculated server-side from parsed messages including:
- Message frequency over time
- Participant activity distribution  
- Hourly activity patterns
- Sentiment distribution

Data formatted specifically for Recharts visualization components on the frontend.

**Social Media Integration**: 
- **Open Graph tags**: Static OG tags in `client/index.html` for social media sharing previews
- **OG image**: Matcha-themed image (`/og-image.jpg`) displayed when links are shared
- **Dynamic meta tags**: Client-side JavaScript updates OG tags with absolute URLs for better compatibility
- All shared links use consistent metadata for brand consistency