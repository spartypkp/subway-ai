#!/usr/bin/env node

const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Load environment variables from .env.local
const envFile = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !match[1].startsWith('#')) {
      process.env[match[1]] = match[2].replace(/^['"](.*)['"]$/, '$1').trim();
    }
  });
  console.log('Loaded environment variables from .env.local');
}

// Make sure database URL is trimmed to avoid whitespace issues
const dbUrl = (process.env.DATABASE_URL || '').trim();
console.log(`Using database URL: ${dbUrl}`);

// Create connection pool directly in this script
const pool = new Pool({
  connectionString: dbUrl || 'postgresql://postgres:postgres@localhost:5432/subwayai',
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
});

// Create a db object with a query method - similar to our src/lib/db.ts
const db = {
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Create a sample project
    const projectId = uuidv4();
    const projectName = 'Sample Project';
    
    console.log(`Creating project: ${projectName}`);
    await db.query(
      `INSERT INTO projects (id, name, description, created_at, updated_at, settings, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        projectId, 
        projectName, 
        'A sample project to test the application', 
        new Date(), 
        new Date(),
        JSON.stringify({ theme: 'dark' }),
        JSON.stringify({ 
          tech_stack: { 
            frontend: ['Next.js', 'React', 'Tailwind CSS'],
            backend: ['Node.js', 'PostgreSQL'] 
          } 
        })
      ]
    );
    
    // Create a main branch ID
    const mainBranchId = uuidv4();
    
    // Create root node
    const rootNodeId = uuidv4();
    console.log('Creating root node');
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        rootNodeId,
        projectId,
        mainBranchId,
        null,
        '',
        'root',
        JSON.stringify({ title: 'Main Conversation', context: {} }),
        'system',
        new Date(),
        0
      ]
    );
    
    // Create a welcome message from the AI
    const welcomeMessageId = uuidv4();
    console.log('Creating welcome message');
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        welcomeMessageId,
        projectId,
        mainBranchId,
        rootNodeId,
        '',
        'message',
        JSON.stringify({ 
          role: 'assistant', 
          text: 'Welcome to Subway AI! I\'m Claude, your AI assistant. How can I help you today?' 
        }),
        'ai',
        new Date(),
        1
      ]
    );
    
    // Create a branch for exploring alternative topics
    const altBranchId = uuidv4();
    const forkNodeId = uuidv4();
    
    console.log('Creating branch fork point');
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        forkNodeId,
        projectId,
        altBranchId,
        welcomeMessageId,
        '',
        'fork',
        JSON.stringify({ reason: 'Exploring different topics' }),
        'system',
        new Date(),
        0
      ]
    );
    
    // Create first message in alternative branch
    const altMessageId = uuidv4();
    console.log('Creating message in alternative branch');
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        altMessageId,
        projectId,
        altBranchId,
        forkNodeId,
        '',
        'message',
        JSON.stringify({ 
          role: 'assistant', 
          text: 'This is the start of an alternative conversation branch. Here we can explore different topics or approaches.' 
        }),
        'ai',
        new Date(),
        1
      ]
    );
    
    console.log('Database seeding completed!');
    console.log(`Created project: ${projectName} (ID: ${projectId})`);
    console.log(`Created main branch: ${mainBranchId}`);
    console.log(`Created alternative branch: ${altBranchId}`);
    
    return { projectId, mainBranchId, altBranchId };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    // Clean up pool and exit
    pool.end();
  }
}

// Run the seed function
seedDatabase().catch(err => {
  console.error('Failed to seed database:', err);
  process.exit(1);
}); 