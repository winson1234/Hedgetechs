# Production Deployment Guide

## Initial Setup

### 1. Create Environment File

Create `.env` file in the `deployment` directory:

```bash
cd deployment
cp ../.env.example .env
nano .env
```

Update with your production values:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=brokerage

# Redis
REDIS_PASSWORD=your_redis_password_here

# JWT (MUST be at least 32 characters!)
JWT_SECRET=your_production_jwt_secret_min_32_characters_long

# Stripe
STRIPE_SECRET_KEY=sk_live_your_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here

# NOWPayments
NOWPAYMENTS_API_KEY=your_api_key_here

# Email (Resend)
RESEND_API_KEY=re_your_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Market Data
TWELVE_DATA_API_KEY=your_twelve_data_key
MARKET_DATA_PROVIDER=hybrid
ENABLE_EXTERNAL_FETCH=true

# AWS Face Liveness
AWS_AI_ACCESS_KEY=your_aws_key
AWS_AI_SECRET_KEY=your_aws_secret
AWS_AI_REGION=us-east-1

# Frontend
VITE_API_URL=https://api.yourdomain.com
APP_URL=https://yourdomain.com
WEBHOOK_URL=https://api.yourdomain.com/api/v1/webhooks

# CORS (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Environment
ENVIRONMENT=production
```

### 2. Start Services (First Time)

```bash
cd deployment

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Watch logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Note**: On first startup, the database initialization scripts will automatically:
- Create all tables (users, accounts, transactions, deposits, withdrawals, etc.)
- Create indexes for performance
- Set up sequences and functions
- This only happens when the database volume is empty (first time)

### 3. Verify Database Initialization

```bash
# Check if tables were created
docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "\dt"

# Should show 19 tables including:
# - users
# - accounts
# - transactions
# - deposits
# - withdrawals
# - notifications
# - instruments
# etc.

# Check table counts
docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
```

### 4. Test the Backend

```bash
# Check backend health
curl http://localhost:8080/api/v1/ticker?symbols=BTCUSDT

# Test registration endpoint
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "full_name": "Test User"
  }'
```

---

## Database Reinitialization

### If you need to completely reset the database:

```bash
cd deployment

# Stop services
docker-compose -f docker-compose.prod.yml down

# Remove database volume (DANGER: This deletes all data!)
docker volume rm deployment_postgres-data

# Start services again (will reinitialize database)
docker-compose -f docker-compose.prod.yml up -d

# Watch initialization logs
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### If you need to add new tables/migrations without deleting data:

```bash
# Connect to database
docker exec -it brokerage-postgres-prod psql -U postgres -d brokerage

# Run your SQL commands
# Example:
CREATE TABLE IF NOT EXISTS new_table (...);

# Exit
\q
```

---

## Useful Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Restart Services

```bash
# All services
docker-compose -f docker-compose.prod.yml restart

# Specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

### Database Backup

```bash
# Create backup
docker exec brokerage-postgres-prod pg_dump -U postgres brokerage > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i brokerage-postgres-prod psql -U postgres -d brokerage < backup_20241216_120000.sql
```

### Access Database

```bash
# PostgreSQL
docker exec -it brokerage-postgres-prod psql -U postgres -d brokerage

# Redis
docker exec -it brokerage-redis-prod redis-cli -a your_redis_password
```

---

## Nginx/Reverse Proxy Setup

Example nginx configuration for production:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable SSL with Let's Encrypt:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

---

## Troubleshooting

### Problem: "relation users does not exist"

**Cause**: Database not initialized or volume already exists from previous failed setup.

**Solution**:
```bash
# Stop and remove volumes
docker-compose -f docker-compose.prod.yml down -v

# Start again (will reinitialize)
docker-compose -f docker-compose.prod.yml up -d
```

### Problem: Backend can't connect to database

**Check**:
1. Is postgres container running? `docker ps | grep postgres`
2. Check backend logs: `docker logs brokerage-backend-prod`
3. Verify DATABASE_URL is correct in backend environment

### Problem: Frontend shows CORS errors

**Solution**: Update `ALLOWED_ORIGINS` in `.env`:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Then restart backend:
```bash
docker-compose -f docker-compose.prod.yml restart backend
```

---

## Monitoring

### Health Checks

```bash
# PostgreSQL
docker exec brokerage-postgres-prod pg_isready -U postgres

# Redis
docker exec brokerage-redis-prod redis-cli -a $REDIS_PASSWORD ping

# Backend
curl http://localhost:8080/api/v1/ticker?symbols=BTCUSDT

# Frontend
curl http://localhost:3000/
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

---

## Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Use strong JWT_SECRET (min 32 chars)
- [ ] Enable SSL/HTTPS with valid certificates
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Enable Docker logging
- [ ] Monitor disk space
- [ ] Update Docker images regularly
- [ ] Use non-root users in containers (if needed)
- [ ] Enable audit logging

---

## Support

For issues, check:
1. Docker logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Database connectivity: `docker exec -it brokerage-postgres-prod psql -U postgres -d brokerage`
3. Backend health: `curl http://localhost:8080/api/v1/ticker?symbols=BTCUSDT`
