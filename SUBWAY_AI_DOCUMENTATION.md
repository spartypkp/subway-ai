# Subway AI Documentation

## Project Vision

Subway AI is a visual conversation platform that reimagines LLM interactions as intuitive subway maps. The project transforms complex AI discussions into navigable, branching conversation threads represented as metro lines, making it easier to explore alternative thought paths and maintain context in sophisticated AI workflows.

Unlike traditional chat interfaces that present conversations as linear threads, Subway AI introduces a spatial dimension to conversations, allowing users to create, visualize, and navigate multiple parallel discussion branches.

### Core Metaphor: Conversations as Subway Maps

- **Primary Conversation Line**: The main discussion thread appears as a central subway line
- **Alternative Pathways**: Conversation branches fork off as new subway lines
- **Messages as Stations**: Each message is represented as a "station" along a line
- **Branch Points**: Places where conversation diverges, creating new exploration paths
- **Visual Navigation**: Color-coded lines help distinguish different conversation branches

## UI/UX Design Principles

Subway AI's user experience is built around five core principles:

### 1. Visual Clarity

- **Color-coded branches**: Each conversation branch has a distinct color for easy identification
- **Clean message cards**: Clear distinction between user and assistant messages
- **Visual branch points**: Branch points are clearly marked in the conversation flow
- **Minimalist interface**: Focus on content with a clean, distraction-free UI

### 2. Intuitive Navigation

- **List and Subway Views**: Toggle between traditional list view and visual subway map
- **Branch creation**: Easily create new conversation branches from any assistant message
- **Time indicators**: Messages show timestamps for temporal context
- **Interactive stations**: Click on stations to view message content or create branches

### 3. Context Retention

- **Spatial memory**: The subway map visualization helps users remember where they are in the conversation
- **Branch labels**: Each branch can be named to describe its purpose or focus
- **Branch point markers**: Clear visual indicators show where branches diverge
- **Historical view**: Ability to view the entire conversation history in a spatial layout

### 4. Progressive Disclosure

- **Main view simplicity**: Focus on the current branch with minimal clutter
- **Minimap navigation**: Overview of the entire conversation structure in the sidebar
- **Branch details on demand**: Access additional information about branches as needed
- **Streamlined controls**: Essential functions are immediately accessible, advanced features available when needed

### 5. Responsive Design

- **Adapts to screen sizes**: Fully functional on both desktop and mobile devices
- **Consistent experience**: Core functionality maintained across different form factors
- **Touch-friendly**: Designed for both mouse and touch interaction
- **Performance focus**: Fast loading and smooth transitions across devices

## Tech Stack

### Frontend
- **Framework**: Next.js 15 with React 19
- **State Management**: React Hooks (useState, useEffect, useRef)
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Custom components built on Radix UI primitives
- **Typography**: Custom prose styling for message content
- **Animations**: Subtle CSS transitions and animations for UI interactions

### Backend
- **API Layer**: Next.js API Routes
- **Database**: PostgreSQL with JSONB for flexible content storage
- **Authentication**: (Optional depending on implementation)
- **Branching Logic**: Custom branch management system

## Key Components & Architecture

### Database Schema

The database structure focuses on three main entities:

#### Projects
- Represent work contexts with metadata and settings
- Serve as containers for conversation branches
- Store project-level preferences and metadata

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  settings JSONB,
  context JSONB,
  metadata JSONB
);
```

#### Timeline Nodes
- Core data structure for messages and conversation points
- Support three types: 'root', 'message', and 'fork'
- Linked through parent-child relationships
- Store content as structured JSONB data

```sql
CREATE TABLE timeline_nodes (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL, -- Branch ID for grouping messages
  expert_id VARCHAR(255), -- (Legacy field)
  parent_id UUID REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'root', 'message', 'fork'
  status VARCHAR(50), -- 'archived', 'hidden', 'featured'
  content JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  position INTEGER NOT NULL,
  metadata JSONB
);
```

### Core UI Components

#### MessageList
- Displays conversation threads with proper styling
- Supports distinct user/assistant message cards
- Enables branch creation from any assistant message
- Implements polling for response updates
- Handles loading states and animations

#### Minimap
- Visualizes the conversation structure as a subway map
- Toggles between list and graphical subway views
- Uses SVG for rendering subway lines and stations
- Implements color-coding based on branch depth
- Provides interactive navigation between branches

#### ChatControls
- Manages user input and message submission
- Handles loading states during message processing
- Connects to appropriate API endpoints
- Provides responsive input area

#### ProjectDialog
- Implements project creation and management
- Manages project metadata and settings
- Supports creating new conversation contexts

### Data Flow

1. **User Input**: Captured through ChatControls component
2. **Message Creation**: New messages stored as timeline nodes in the database
3. **Branch Management**: Messages organized into branches for navigation
4. **Visualization**: Minimap renders the conversation structure as a subway map
5. **Navigation**: Users can navigate between branches and conversation points

## Implementation Status

### Completed Features
- ✅ Project creation and management
- ✅ Basic message display and conversation threads
- ✅ Branch creation and navigation
- ✅ Subway map visualization (list and graphical views)
- ✅ Message polling for updates
- ✅ Timeline node structure and storage

### In Development
- 🔄 Enhanced mobile responsiveness
- 🔄 Improved subway map visualization with zooming
- 🔄 Advanced branch management features
- 🔄 Markdown rendering for message content
- 🔄 Improved error handling and edge cases

## Future Directions

### Enhanced Visualization
- Implement zooming and panning in subway view
- Add mini-map for orientation in complex conversations
- Introduce 3D visualization options

### Advanced Interaction
- Drag-and-drop branch rearrangement
- Message annotation and highlighting
- Shared conversation spaces

### AI Integration
- Multiple AI expert personas with specialized knowledge
- Conversation summarization at branch points
- Automated branch suggestions based on content

### Collaboration
- Real-time multi-user collaboration
- Branch merging capabilities
- Conversation export and sharing

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure database connection in `.env`
4. Run database migrations
5. Start development server: `npm run dev`

### Local Development
The application will be available at http://localhost:3000 