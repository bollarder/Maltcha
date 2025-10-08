# Maltcha - KakaoTalk Conversation Analysis Application

## Overview

Maltcha is a web application that analyzes KakaoTalk conversation exports using AI-powered insights. Users upload their KakaoTalk chat history (.txt files), and the application processes the conversations to generate statistics, visualizations, and AI-driven insights about communication patterns, sentiment, and participant behavior.

The application features a modern, responsive interface with a landing page, file upload system, real-time progress tracking, and comprehensive results display showing all Claude AI analysis including relationship assessment, communication patterns, emotional dynamics, and actionable insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### 2025-01-08: Comprehensive Analysis Display
- **Results Page Redesign**: Now displays all Claude AI analysis content
  - **Multi-turn Analysis** (when available): Shows Turn 1 (relationship assessment, key events, strengths, concerning patterns) and Turn 2 (communication style, emotional expression, relationship dynamics, special patterns, partner status)
  - **4-Stage Analysis** (fallback): Shows deep analysis results with communication style, emotional expression, relationship dynamics, special patterns, and partner status
  - **AI Insights**: Always displays AI-generated actionable insights
- **Schema Updates**: Added `deepAnalysis` field to support both multi-turn (turn1/turn2) and 4-stage analysis structures
- **Data Flow**: `deepAnalysis` now properly saved and retrieved from storage, supporting both analysis methods
- **User Experience**: Results page now shows complete analysis instead of just insights summary

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

**AI Service**: Anthropic Claude API for conversation analysis. Uses the latest "claude-sonnet-4-20250514" model for generating insights about conversation patterns, sentiment analysis, and behavioral trends. The AI performs multi-stage analysis:
1. Pattern extraction from conversation data
2. Sentiment analysis across messages
3. Insight generation based on identified patterns

**Database**: Neon serverless PostgreSQL (configured via `@neondatabase/serverless` adapter). Currently set up but not actively used due to in-memory storage implementation. Required environment variable: `DATABASE_URL`.

**File Processing**: Server-side parsing of KakaoTalk export files. Supports two common KakaoTalk export formats:
- `[Name] [Time] Message` format
- `2024. 1. 15. 오후 9:30, Name : Message` format

The parser extracts timestamps, participant names, and message content, handling Korean text encoding properly.

**Environment Variables**: 
- `DATABASE_URL` - PostgreSQL connection string (required by Drizzle config)
- `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY_ENV_VAR` - Anthropic API credentials
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