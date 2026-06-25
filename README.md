# eCommerce Platform Backend

Production-ready Node.js/Express backend with MongoDB for the eCommerce platform.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Start production server
npm start
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon (auto-restart) |
| `npm run dev:clean` | Kill port 5000 and start dev server |
| `npm run kill-port` | Kill any process using port 5000 |
| `npm test` | Run all tests with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint on source files |
| `npm run seed` | Seed database with sample data |

## Port Management

The server includes **automatic port conflict detection** and **graceful fallback**:

- Default port: `5000` (configurable via `PORT` env variable)
- If port is in use, automatically tries ports 5001, 5002, etc.
- Maximum 10 port retry attempts
- Clear console warnings when using fallback port

### Troubleshooting Port Conflicts

#### Issue: `EADDRINUSE: address already in use :::5000`

**Quick Fix:**
```bash
# Option 1: Use the clean start script
npm run dev:clean

# Option 2: Manually kill port 5000
npm run kill-port 5000

# Option 3: Kill specific process (Windows)
netstat -ano | findstr :5000
taskkill /F /PID <process_id>

# Option 3: Kill specific process (Mac/Linux)
lsof -ti:5000 | xargs kill -9
```

**Prevention:**
- Always use `Ctrl+C` to stop the server gracefully
- Use `npm run dev:clean` which auto-kills old instances
- Check for zombie Node processes: `tasklist | findstr node` (Windows)

## Features

### Automatic Port Detection
The server automatically finds an available port if the default is in use:

```javascript
// Tries ports 5000, 5001, 5002... up to 5009
[Server] Port 5000 is already in use, trying 5001...
[Server] running in development mode on port 5001
[Server] Note: Default port 5000 was in use, using port 5001 instead
```

### Graceful Shutdown
Handles `SIGTERM` and `SIGINT` signals for clean shutdown:

```bash
# Press Ctrl+C
[Server] SIGINT received, closing server gracefully...
[Server] HTTP server closed
```

### Error Handling
- Unhandled promise rejections
- Uncaught exceptions
- Server startup errors
- Database connection errors

## Environment Variables

Create a `.env` file in the backend root:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRE=90d

# Email (NodeMailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=noreply@ecommerce.com
FROM_NAME=eCommerce Platform

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:5000/api-docs
- **API Base URL**: http://localhost:5000/api

## Database Setup

### Local MongoDB

```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### MongoDB Atlas (Cloud)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### Seed Database

```bash
npm run seed
```

This creates sample:
- Users (admin, customers)
- Categories
- Products
- Orders

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── db.js        # MongoDB connection
│   │   └── swagger.js   # API documentation
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── validation/      # Request validation schemas
│   ├── scripts/         # Utility scripts
│   ├── __tests__/       # Test files
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── scripts/             # Build/deployment scripts
│   └── kill-port.js     # Port cleanup utility
├── .env                 # Environment variables (gitignored)
├── .env.example         # Environment template
├── nodemon.json         # Nodemon configuration
└── package.json
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` values
3. Configure production MongoDB URI
4. Set up payment gateway production keys
5. Configure email service
6. Set proper `FRONTEND_URL` for CORS

### Docker Deployment

```bash
# Build image
docker build -t ecommerce-backend .

# Run container
docker run -d -p 5000:5000 --env-file .env ecommerce-backend
```

### Using Docker Compose

```bash
# From project root
docker-compose up -d backend
```

## Security Features

- ✅ Helmet.js (HTTP headers)
- ✅ CORS protection
- ✅ Rate limiting
- ✅ XSS protection
- ✅ NoSQL injection prevention
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Input validation (Joi)
- ✅ MongoDB sanitization

## Performance

- ✅ MongoDB indexing
- ✅ Query optimization
- ✅ Pagination
- ✅ Response compression
- ✅ Efficient logging (Winston)

## Common Issues

### MongoDB Connection Failed

```bash
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Ensure MongoDB is running: `mongod` or check service
- Verify `MONGODB_URI` in `.env`
- Check firewall settings

### JWT Secret Missing

```bash
Error: JWT_SECRET must be defined
```

**Solution:**
- Copy `.env.example` to `.env`
- Set `JWT_SECRET=your_secret_key`

### Port Already in Use

```bash
Error: EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
npm run kill-port 5000
# or
npm run dev:clean
```

## Monitoring

The server logs all:
- HTTP requests (Morgan)
- Errors (Winston)
- Database queries (Mongoose debug mode)

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## Support

For issues or questions:
1. Check this README
2. Review API documentation at `/api-docs`
3. Check test files for usage examples
4. Review error logs in `logs/` directory

## License

ISC
# Ecommerce-app
# Ecommerce-app
# Ecommerce-app
# ecommerce-backend
