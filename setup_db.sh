#!/bin/bash

# Subway AI - Database Setup Script
# This script sets up the entire database including schema and test data

echo "🚇 Subway AI - Database Setup"
echo "============================"

# Database connection settings
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-subway_ai}
DB_USER=${DB_USER:-s}
DB_PASSWORD=${PGPASSWORD:-}

# Create database if it doesn't exist
echo "📦 Creating database if it doesn't exist..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

if [ $? -ne 0 ]; then
  echo "❌ Failed to create database. Check your connection settings."
  exit 1
fi

echo "✅ Database exists or was created successfully."
echo

# Apply schema
echo "🔧 Applying database schema..."
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f schema.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to apply schema."
  exit 1
fi

echo "✅ Schema applied successfully."
echo

# Seed test data
echo "🌱 Seeding test data..."
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f seed.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to seed test data."
  exit 1
fi

echo "✅ Test data seeded successfully."
echo

# Show branch information
echo "🔍 Test Project Summary:"
echo "-----------------------"
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -c "
SELECT 
  branch_id, 
  COUNT(*) AS node_count,
  MIN(created_at) AS started_at
FROM 
  timeline_nodes 
WHERE 
  project_id = '11111111-1111-1111-1111-111111111111'
GROUP BY 
  branch_id
ORDER BY 
  MIN(created_at);
"

echo
echo "🎉 Database setup complete!"
echo
echo "Project ID: 11111111-1111-1111-1111-111111111111"
echo
echo "To view the complete tree structure, run:"
echo "psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f view_tree.sql"
echo

chmod +x setup_db.sh 