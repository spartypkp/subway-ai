# Subway AI Testing Data

This directory contains scripts to set up a test database for the Subway AI application with sample conversation data including multiple branches.

## Test Data Structure

The sample data represents a single project with four different conversation branches:

1. **Main Branch** (ID: `main-branch`)
   - Contains 10 messages discussing data structures for storing trees
   - Serves as the primary conversation path

2. **NoSQL Branch** (ID: `nosql-branch`)
   - Forks from message 4 in the main branch
   - Explores NoSQL database solutions for storing tree structures
   - Contains 6 messages

3. **Graph Database Branch** (ID: `graph-branch`)
   - Forks from message 6 in the main branch
   - Discusses graph database approaches for tree structures
   - Contains 8 messages

4. **Performance Branch** (ID: `performance-branch`)
   - Also forks from message 6 in the main branch
   - Focuses on performance optimization techniques for large trees
   - Contains 6 messages

This structure creates a realistic subway-style map with multiple branches forking from different points in the conversation.

## Files

- `schema.sql` - Creates the database schema
- `seed.sql` - Contains the test data
- `view_tree.sql` - Query to visualize the conversation tree structure
- `seed.sh` - Script to run just the seed file
- `setup_db.sh` - Complete setup script that creates DB, schema, and runs seed

## Usage

### Prerequisites

- PostgreSQL installed and running
- Database user with permissions to create databases and tables

### Setup Environment Variables (Optional)

```bash
# Set database connection details (or use defaults)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=subway_ai
export DB_USER=postgres
export PGPASSWORD=your_password  # Required for passwordless login
```

### Complete Setup

Run the following command to set up everything at once:

```bash
./setup_db.sh
```

This will:
1. Create the database if it doesn't exist
2. Apply the schema
3. Seed the test data
4. Display a summary of the branches

### View Tree Structure

To visualize the conversation tree structure:

```bash
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f view_tree.sql
```

This will output a hierarchical representation of all messages with indentation showing the parent-child relationships.

## Data Model

### Projects Table

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

### Timeline Nodes Table

```sql
CREATE TABLE timeline_nodes (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id VARCHAR(255) NOT NULL, 
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

### Node Types

- **root**: Beginning of a branch
  ```json
  { "reason": "Main conversation" }
  ```

- **message**: User or AI message
  ```json
  { "text": "Message content", "role": "user|assistant" }
  ```

- **fork**: Branch creation point
  ```json
  { "reason": "Exploring alternative approach" }
  ```

## Test Project ID

The test project has a fixed ID for easy reference:
- Project ID: `11111111-1111-1111-1111-111111111111` 