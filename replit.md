# Maltcha - KakaoTalk Conversation Analysis Application

## Overview

Maltcha is a web application that analyzes KakaoTalk conversation exports using AI-powered insights. Users upload their KakaoTalk chat history (.txt files), and the application processes the conversations to generate statistics, visualizations, and AI-driven insights about communication patterns, sentiment, and participant behavior.

The application features a modern, responsive interface with a landing page, file upload system, real-time progress tracking, and comprehensive results visualization with charts and AI-generated insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server.

**UI Framework**: shadcn/ui component library built on Radix UI primitives, styled with Tailwind CSS. The design system uses a custom color palette with primary green tones and supports dark mode.

**Routing**: Client-side routing implemented with Wouter, a lightweight alternative to React Router. The application has four main routes:
- `/` - Landing page with feature showcase
- `/upload` - File upload interface
- `/loading/:id` - Progress tracking during analysis
- `/results/:id` - Results display with charts and insights

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

**Async Processing**: Analysis operations run asynchronously after returning an initial response. The client polls for completion status, allowing the server to handle long-running AI operations without blocking.

**Error Handling**: Centralized error handling with appropriate HTTP status codes. Validation errors return 400, not-found errors return 404, and server errors return 500.

### Data Storage Solutions

**Current Implementation**: In-memory storage using a Map-based implementation (`MemStorage` class). This is suitable for development and demonstration but data is lost on server restart.

**Storage Interface**: Well-defined `IStorage` interface that abstracts storage operations, making it straightforward to swap implementations. The interface supports:
- Creating analysis records
- Retrieving analysis by ID
- Updating analysis with results

**Schema Design**: Zod schemas define the data structure for type safety and runtime validation:
- `Message`: Individual chat messages with timestamp, participant, and content
- `AnalysisResult`: Complete analysis including metadata, processing status, parsed messages, statistics, chart data, and AI insights
- `InsertAnalysis`: Input schema for creating new analyses

**Database Ready**: The project includes Drizzle ORM configuration pointing to PostgreSQL, indicating planned migration to persistent storage. The storage interface pattern enables this transition without requiring API changes.

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