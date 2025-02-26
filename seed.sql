-- seed.sql - Test data for Subway AI
-- Creates a test project with a main branch, conversation, and a child branch

-- 1. Create a test project
INSERT INTO projects (
    id, name, description, created_at, updated_at, created_by
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000', 
    'Test Project', 
    'A sample project for testing the subway visualization', 
    NOW(), 
    NOW(), 
    'seed_script'
);

-- 2. Create the main branch
INSERT INTO branches (
    id, project_id, name, color, depth, is_active, created_at, created_by
) VALUES (
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174000',
    'Main Line',
    '#3b82f6', -- blue-500
    0,         -- depth 0 for main branch
    true,
    NOW(),
    'seed_script'
);

-- 3. Create the root node in the main branch
INSERT INTO timeline_nodes (
    id, project_id, branch_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174010',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    'root',
    'Project start',
    'system',
    0,
    'seed_script',
    NOW()
);

-- 4. Add some conversation in the main branch

-- First user message
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174011',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174010',
    'user-message',
    'Hello! Can you tell me about the benefits of visualizing conversations as subway maps?',
    'user',
    1,
    'user123',
    NOW() + interval '1 minute'
);

-- First assistant response
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174012',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174011',
    'assistant-message',
    'Visualizing conversations as subway maps offers several benefits:

1. **Spatial context**: It gives conversations a physical dimension, making it easier to track the flow and branches.
2. **Branch visualization**: Different conversation paths can be explored as separate "lines" on the map.
3. **Navigation**: Users can easily jump between different conversation threads while maintaining context.
4. **Visual memory**: The spatial layout helps users remember where different information lives in a complex conversation.
5. **Context retention**: The structure makes it clear how different ideas connect and relate to each other.

Would you like to know more about how this metaphor specifically helps with complex AI conversations?',
    'assistant',
    2,
    'ai',
    NOW() + interval '2 minutes'
);

-- Second user message
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174013',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174012',
    'user-message',
    'Yes, I''d like to know more about how this works for AI conversations specifically. Also, what are some challenges with this approach?',
    'user',
    3,
    'user123',
    NOW() + interval '3 minutes'
);

-- Second assistant response (keeping this as an assistant message)
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174014',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174013',
    'assistant-message',
    'For AI conversations specifically, the subway map visualization helps with:

1. **Exploring alternatives**: You can branch off to explore different approaches to the same question without losing your original context.
2. **Comparing responses**: Different branches can show how varying prompts or instructions affect AI outputs.
3. **Versioning**: Keep multiple versions of a conversation to track how refinements improve outputs.
4. **Complex workflows**: Manage multi-step reasoning processes by keeping each thread organized.
5. **Documentation**: Create a visual record of your exploration process for later reference.

Some challenges with this approach include:

1. **Learning curve**: Users need to understand the subway metaphor and how to navigate it.
2. **Visual complexity**: Very deep or wide conversation trees can become difficult to display clearly.
3. **Context switching**: Moving between branches requires mental context-switching.
4. **Information density**: Balancing the amount of information displayed at once can be difficult.

Would you like to know more about the technical implementation?',
    'assistant',
    4,
    'ai',
    NOW() + interval '4 minutes'
);

-- 5. Create a separate branch point after the assistant message
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174015',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174014',
    'branch-point',
    NULL, -- Branch points don't need message content
    'system',
    5, -- Next position after the assistant message
    'seed_script',
    NOW() + interval '4.5 minutes'
);

-- 6. Create a child branch that stems from that branch point
INSERT INTO branches (
    id, project_id, name, parent_branch_id, branch_point_node_id, color, depth, 
    is_active, created_at, created_by
) VALUES (
    '123e4567-e89b-12d3-a456-426614174002',
    '123e4567-e89b-12d3-a456-426614174000',
    'Technical Details',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174015', -- Using the dedicated branch-point node
    '#ef4444', -- red-500
    1,         -- depth 1 for first branch
    true,
    NOW() + interval '5 minutes',
    'user123'
);

-- 7. Create a branch-root node in the child branch
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174020',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174002',
    '123e4567-e89b-12d3-a456-426614174015', -- Parent is the branch point, not the assistant message
    'branch-root',
    'Branch starting point',
    'system',
    0,
    'seed_script',
    NOW() + interval '5 minutes'
);

-- 8. Add conversation in the child branch
-- First user message in child branch
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174021',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174002',
    '123e4567-e89b-12d3-a456-426614174020',
    'user-message',
    'Yes, I''d love to know more about the technical implementation. What technologies would you recommend for building this?',
    'user',
    1,
    'user123',
    NOW() + interval '6 minutes'
);

-- First assistant response in child branch
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174022',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174002',
    '123e4567-e89b-12d3-a456-426614174021',
    'assistant-message',
    'For implementing a subway map visualization for conversations, I recommend:

1. **Frontend Technologies**:
   - React or Next.js for the user interface
   - React Flow or D3.js for the interactive subway map visualization
   - Tailwind CSS for styling and responsive design
   - Zustand or Redux for state management
   
2. **Backend Technologies**:
   - Node.js with Express or Next.js API routes
   - PostgreSQL for storing the conversation data structure
   - TypeScript for type safety across the application
   
3. **Data Structure**:
   - Nodes represent messages and branch points
   - Edges represent the connections between messages
   - Branches are stored as separate entities with metadata
   - Position data for spatial arrangement of the subway map

4. **Key Features to Implement**:
   - Real-time updates as conversations progress
   - Branch creation from any assistant message
   - Visual cues for branch points and transfers
   - Minimap for navigating complex conversations
   - Search and filtering across branches

Would you like me to elaborate on any specific aspect of the implementation?',
    'assistant',
    2,
    'ai',
    NOW() + interval '7 minutes'
);

-- 9. Continue conversation in the main branch after the branch point
-- Third user message in main branch - now connects to the branch point instead of the assistant message
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174016',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174015', -- Parent is the branch point now
    'user-message',
    'I''m more interested in the user experience aspects. How do you think users will interact with this subway map metaphor? Will it be intuitive?',
    'user',
    6, -- Position is now 6 (after branch point at 5)
    'user123',
    NOW() + interval '8 minutes'
);

-- Third assistant response in main branch
INSERT INTO timeline_nodes (
    id, project_id, branch_id, parent_id, type, message_text, message_role, position, created_by, created_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174017',
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174016',
    'assistant-message',
    'The user experience of the subway map metaphor depends greatly on implementation, but here are some thoughts:

1. **Initial intuitiveness**: Most users are familiar with subway/metro maps, so the basic concept of "lines" and "stations" is relatively intuitive. However, applying this to conversations is novel and might require a brief orientation.

2. **Learning curve**: I expect a moderate learning curve:
   - New users will quickly understand the main line of conversation
   - The concept of branching to explore alternatives will need clear visual cues
   - Full mastery might take a few sessions of use

3. **Key UX elements for success**:
   - Clear visual distinction between branches (color coding)
   - Obvious indicators for branch points
   - Easy navigation between branches
   - A "you are here" indicator for current position
   - Ability to collapse/expand branches to manage complexity
   - A minimap for orientation in larger conversations

4. **Making it more intuitive**:
   - Progressive disclosure of complexity
   - Simple onboarding tutorial
   - Consistent visual language
   - Familiar interaction patterns (click, drag, zoom)
   - Clear affordances for creating new branches

5. **Potential challenges**:
   - Mobile adaptation will be tricky due to limited screen space
   - Very complex conversations might become visually overwhelming
   - Users might lose track of which branch they''re currently in

Overall, I think with proper implementation, the subway metaphor can become quite intuitive after a short learning period, especially for knowledge workers and those who engage in complex conversations with AI.',
    'assistant',
    7, -- Position is now 7 
    'ai',
    NOW() + interval '9 minutes'
); 