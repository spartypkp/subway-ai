#!/usr/bin/env node

const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');

// Load environment variables from .env.local
const envFile = path.resolve(__dirname, '../../.env.local');
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

// Create a db object with a query method
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

async function checkMessages() {
  try {
    console.log('Checking database message structure...');
    
    // Get all projects
    const projectsResult = await db.query('SELECT id, title FROM projects');
    console.log(`Found ${projectsResult.rows.length} projects`);
    
    for (const project of projectsResult.rows) {
      console.log(`\nProject: ${project.title} (${project.id})`);
      
      // Get all messages for this project
      const messagesResult = await db.query(
        `SELECT id, type, content, branch_id FROM timeline_nodes 
         WHERE project_id = $1 
         ORDER BY created_at ASC`,
        [project.id]
      );
      
      console.log(`Found ${messagesResult.rows.length} timeline nodes`);
      
      // Check content structure for each message
      for (const node of messagesResult.rows) {
        console.log(`\nNode ID: ${node.id} (Type: ${node.type}, Branch: ${node.branch_id})`);
        
        try {
          let content = node.content;
          
          // Try to parse if it's a string
          if (typeof content === 'string') {
            try {
              content = JSON.parse(content);
              console.log('Content: Successfully parsed from JSON string');
            } catch (e) {
              console.log('Content: Not valid JSON, treating as raw string');
            }
          } else if (typeof content === 'object') {
            console.log('Content: Already an object');
          } else {
            console.log(`Content: Unexpected type: ${typeof content}`);
          }
          
          // Show content details for message nodes
          if (node.type === 'message') {
            if (content.role) {
              console.log(`Message Role: ${content.role}`);
            } else {
              console.log('WARNING: Missing role in message content');
            }
            
            if (content.text) {
              console.log(`Message Text: ${content.text.substring(0, 50)}${content.text.length > 50 ? '...' : ''}`);
            } else {
              console.log('WARNING: Missing text in message content');
            }
          }
        } catch (error) {
          console.error(`Error processing node ${node.id}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking messages:', error);
  } finally {
    // Clean up pool and exit
    pool.end();
  }
}

// Run the check function
checkMessages().catch(err => {
  console.error('Failed to check messages:', err);
  process.exit(1);
}); 