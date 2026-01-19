#!/bin/bash

echo "🔧 Setting up database..."

# Install/update Prisma CLI to match client version
echo "📦 Installing Prisma CLI..."
npm install prisma@^6.19.2 --save-dev

# Generate Prisma Client
echo "🔨 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the server: npm run start:dev"
echo "2. Seed the database: curl -X POST http://localhost:3000/seed"
