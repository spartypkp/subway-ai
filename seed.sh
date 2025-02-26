#!/bin/bash

# Subway AI - Database Seeding Script

echo "🚇 Subway AI - Seeding Test Data"
echo "================================="

# Database connection settings
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-subwayai}
DB_USER=${DB_USER:-s}

# Check if PGPASSWORD is set in environment
if [ -z "$PGPASSWORD" ]; then
  echo "⚠️  Warning: PGPASSWORD environment variable not set."
  echo "You might be prompted for a password or authentication might fail."
  echo
fi

echo "🔄 Running seed script..."
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo

# Run the SQL seed file
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f seed.sql

if [ $? -eq 0 ]; then
  echo "✅ Seed completed successfully!"
  echo
  echo "Test project details:"
  echo "- Project ID: 11111111-1111-1111-1111-111111111111"
  echo "- Main Branch: main-branch"
  echo "- NoSQL Branch: nosql-branch (fork from message 4)"
  echo "- Graph Branch: graph-branch (fork from message 6)"
  echo "- Performance Branch: performance-branch (fork from message 6)"
  echo
else
  echo "❌ Error running seed script."
  echo "Check your database connection settings and try again."
fi 