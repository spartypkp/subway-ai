#!/bin/bash

# Exit on error
set -e

# Database configuration
DB_NAME="subwayai"
DB_USER="$USER"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

echo "Setting up PostgreSQL database for Subway AI..."

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    read -p "Database '$DB_NAME' already exists. Do you want to drop it and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping database '$DB_NAME'..."
        dropdb "$DB_NAME"
    else
        echo "Aborting database setup."
        exit 0
    fi
fi

# Create database
echo "Creating database '$DB_NAME'..."
createdb "$DB_NAME"

# Apply schema
echo "Applying database schema..."
psql -d "$DB_NAME" -f "$(dirname "$0")/../src/lib/schema.sql"

# Update .env.local file
echo "Updating DATABASE_URL in .env.local..."
ENV_FILE="$(dirname "$0")/../.env.local"

# Check if .env.local exists
if [ -f "$ENV_FILE" ]; then
    # Check if DATABASE_URL exists
    if grep -q "DATABASE_URL=" "$ENV_FILE"; then
        # Replace DATABASE_URL line
        sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$DB_USER:@localhost:5432/$DB_NAME|" "$ENV_FILE"
        rm "$ENV_FILE.bak"
    else
        # Add DATABASE_URL line
        echo "" >> "$ENV_FILE"
        echo "# Database connection string for local PostgreSQL" >> "$ENV_FILE"
        echo "DATABASE_URL=postgresql://$DB_USER:@localhost:5432/$DB_NAME" >> "$ENV_FILE"
    fi
else
    # Create .env.local file
    echo "# Database connection string for local PostgreSQL" > "$ENV_FILE"
    echo "DATABASE_URL=postgresql://$DB_USER:@localhost:5432/$DB_NAME" >> "$ENV_FILE"
fi

echo "Database setup complete! The connection string has been updated in .env.local."
echo "You can now run your application with: npm run dev" 