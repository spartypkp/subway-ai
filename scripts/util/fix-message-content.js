#!/usr/bin/env node

/**
 * This script examines and fixes message content in the database
 * to ensure consistent format for proper display in the UI.
 */

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
console.log(`Using database URL: ${dbUrl.substring(0, 25)}...`);

// Create connection pool directly
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

/**
 * Function to normalize message content to ensure consistent format
 */
function normalizeMessageContent(content) {
  try {
    // If content is already a string, try to parse it as JSON
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        
        // If parsed successfully and has expected structure, return as is
        if (typeof parsed === 'object' && parsed !== null) {
          if ('text' in parsed && 'role' in parsed) {
            console.log('Content already in correct format (JSON string)');
            return content;
          } else {
            // Missing expected fields, add them
            const normalized = {
              text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
              role: 'assistant'
            };
            console.log('Fixed missing fields in parsed content');
            return JSON.stringify(normalized);
          }
        }
      } catch (e) {
        // Not valid JSON, treat as raw text and wrap in proper structure
        console.log('Content is plain string, normalizing to proper structure');
        return JSON.stringify({
          text: content,
          role: 'assistant'
        });
      }
    } 
    
    // If content is already an object with expected fields, stringify it
    if (typeof content === 'object' && content !== null) {
      if ('text' in content && 'role' in content) {
        console.log('Content already has correct structure (object)');
        return JSON.stringify(content);
      } else {
        // Missing expected fields, add them
        const normalized = {
          text: typeof content.text === 'string' ? content.text : JSON.stringify(content),
          role: content.role || 'assistant'
        };
        console.log('Fixed missing fields in object content');
        return JSON.stringify(normalized);
      }
    }
    
    // Handle other types by converting to string and wrapping
    console.log('Unexpected content type, normalizing');
    return JSON.stringify({
      text: String(content),
      role: 'assistant'
    });
  } catch (error) {
    console.error('Error normalizing content:', error);
    // Return a valid default in case of error
    return JSON.stringify({
      text: 'Error processing message content',
      role: 'assistant'
    });
  }
}

/**
 * Main function to examine and fix message content
 */
async function fixMessageContent() {
  try {
    console.log('Examining and fixing message content in the database...');
    
    // Get all messages
    const messagesResult = await db.query(
      `SELECT id, type, content FROM timeline_nodes 
       WHERE type = 'message'
       ORDER BY created_at ASC`
    );
    
    console.log(`Found ${messagesResult.rows.length} message nodes to examine`);
    
    let fixedCount = 0;
    
    // Examine and fix each message
    for (const node of messagesResult.rows) {
      console.log(`\nExamining message ID: ${node.id}`);
      
      try {
        const originalContent = node.content;
        console.log('Original content type:', typeof originalContent);
        
        if (typeof originalContent === 'object') {
          console.log('Original content (object):', JSON.stringify(originalContent).substring(0, 100));
        } else {
          console.log('Original content:', originalContent?.substring(0, 100));
        }
        
        // Normalize the content
        const normalizedContent = normalizeMessageContent(originalContent);
        
        // Check if normalization changed the content
        const contentChanged = (
          typeof originalContent === 'object' && 
          JSON.stringify(originalContent) !== normalizedContent
        ) || (
          typeof originalContent === 'string' && 
          originalContent !== normalizedContent
        );
        
        if (contentChanged) {
          console.log('Content needs fixing, updating database...');
          await db.query(
            `UPDATE timeline_nodes 
             SET content = $1
             WHERE id = $2`,
            [normalizedContent, node.id]
          );
          fixedCount++;
          console.log('Updated successfully');
        } else {
          console.log('Content already in correct format, no changes needed');
        }
      } catch (error) {
        console.error(`Error processing node ${node.id}:`, error);
      }
    }
    
    console.log(`\nFixed ${fixedCount} out of ${messagesResult.rows.length} messages`);
    
  } catch (error) {
    console.error('Error fixing message content:', error);
  } finally {
    // Clean up pool and exit
    pool.end();
  }
}

// Run the fix function
fixMessageContent().catch(err => {
  console.error('Failed to fix message content:', err);
  process.exit(1);
}); 