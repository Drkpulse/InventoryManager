# 🏢 IT Asset Manager

A comprehensive web-based IT Asset Management System for tracking hardware, software, employees, and mobile devices with complete audit trails and cost analysis.

## ✨ Features

### 📊 **Asset Management**
- **Hardware Assets**: Computers, servers, networking equipment
- **Printers**: Supplier tracking, employee assignments, cost management
- **Mobile Devices**: PDAs with model tracking and cost analysis  
- **SIM Cards**: Carrier management, PDA assignments, monthly cost tracking
- **Software Licenses**: Installation tracking and compliance monitoring

### 👥 **Personnel Management**
- **Employee Profiles**: Contact information and asset assignments
- **Department Organization**: Hierarchical department structure
- **User Management**: Role-based access control with admin/user roles

### 💰 **Financial Tracking**
- **Cost Analysis**: Equipment purchase costs and monthly recurring costs
- **Client Management**: Equipment assignments and cost summaries
- **Budget Planning**: Total investment tracking per client

### 🎨 **User Experience**
- **Dark/Light Mode**: System-aware theme switching
- **Multi-language Support**: English, Portuguese, Spanish, French
- **Responsive Design**: Mobile-friendly interface
- **Real-time Notifications**: System alerts and updates

### 🔒 **Security & Compliance**
- **Complete Audit Trails**: Full history tracking for all entities
- **User Authentication**: Secure login with session management
- **Data Validation**: Server-side and client-side validation
- **Change Tracking**: Detailed before/after change logs

### 📈 **Reporting & Analytics**
- **Equipment Reports**: Comprehensive asset listings and status
- **Cost Reports**: Financial analysis and budget tracking
- **Assignment Reports**: Employee and client equipment assignments
- **Export Capabilities**: Data export for external analysis

## 🚀 One-Click Deployment

### **Prerequisites**
- Docker and Docker Compose installed
- 2GB+ RAM available
- 10GB+ disk space

### **Quick Start**
```bash
# Clone the repository
git clone https://github.com/your-username/it-asset-manager.git
cd it-asset-manager

# Run one-click deployment
./deploy.sh
```

The deployment script will:
1. ✅ Check Docker prerequisites
2. 📝 Create environment configuration  
3. 🏗️ Build and start all services
4. 🗄️ Initialize the database with sample data
5. 🌐 Make the application available at http://localhost:3000

### **Default Credentials**
- **Username**: `admin@example.com`
- **Password**: `admin`

⚠️ **Change the default password immediately after first login!**

## 🛠 Manual Installation

### **1. Clone Repository**
```bash
git clone https://github.com/your-username/it-asset-manager.git
cd it-asset-manager
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Database Setup**
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb inventory_db

# Create user and grant permissions
sudo -u postgres psql -c "CREATE USER inventory_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE inventory_db TO inventory_user;"

# Initialize database schema
npm run init-db
```

### **4. Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

Required environment variables:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventory_db
DB_USER=inventory_user
DB_PASSWORD=your_password
SESSION_SECRET=your-super-secret-session-key
NODE_ENV=production
PORT=3000
```

### **5. Start Application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🐳 Docker Deployment

### **Using Docker Compose (Recommended)**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### **Using Docker Only**
```bash
# Build image
npm run docker:build

# Run container (requires separate PostgreSQL)
npm run docker:run
```

## 📚 API Documentation

### **Health Check**
```http
GET /health
```
Returns application health status and uptime.

### **Authentication**
```http
POST /auth/login
POST /auth/logout
```

### **Assets**
```http
GET    /items          # List assets
GET    /items/:id      # Get asset details
POST   /items          # Create asset
PUT    /items/:id      # Update asset
DELETE /items/:id      # Delete asset
```

### **Mobile Devices**
```http
GET    /pdas           # List PDAs
GET    /simcards       # List SIM cards
POST   /pdas           # Create PDA
POST   /simcards       # Create SIM card
```

## 🔧 Configuration

### **Database**
- **Engine**: PostgreSQL 15+
- **Connection Pooling**: Automatic
- **Migrations**: Included in schema.sql

### **Session**
- **Storage**: In-memory (development) / Redis (production recommended)
- **Timeout**: 24 hours default
- **Security**: CSRF protection enabled

### **File Uploads**
- **Location**: `/uploads` directory
- **Max Size**: 10MB default
- **Allowed Types**: Images, documents

### **Theme System**
- **Modes**: Light, Dark, Auto (system preference)
- **Storage**: User preferences in database
- **Real-time**: Immediate theme switching

## 🏗 Architecture

### **Backend Stack**
- **Node.js 18+**: Runtime environment
- **Express.js**: Web framework
- **PostgreSQL**: Primary database
- **EJS**: Template engine
- **bcrypt**: Password hashing

### **Frontend Stack**
- **Vanilla JavaScript**: Client-side functionality
- **CSS3**: Styling with custom properties
- **FontAwesome**: Icon library
- **Bootstrap components**: Form validation

### **DevOps**
- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration
- **Health Checks**: Service monitoring
- **Logging**: Structured application logs

## 📁 Project Structure

```
it-asset-manager/
├── 📂 src/
│   ├── 📂 controllers/     # Business logic
│   ├── 📂 routes/          # API endpoints
│   ├── 📂 views/           # EJS templates
│   ├── 📂 middleware/      # Authentication & validation
│   ├── 📂 config/          # Database & app configuration
│   └── 📂 utils/           # Helper functions
├── 📂 database/            # Schema and migrations
├── 📂 public/              # Static assets (CSS, JS, images)
├── 📂 uploads/             # User-uploaded files
├── 🐳 Dockerfile          # Container configuration
├── 🐳 docker-compose.yml  # Multi-service setup
├── 🚀 deploy.sh           # One-click deployment
└── 📋 package.json        # Dependencies and scripts
```

## 🔍 Troubleshooting

### **Common Issues**

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection
psql -h localhost -U inventory_user -d inventory_db
```

**Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

**Permission Denied on deploy.sh**
```bash
# Make script executable
chmod +x deploy.sh
```

**Docker Issues**
```bash
# Remove all containers and rebuild
docker-compose down -v
docker-compose up --build -d

# Check container logs
docker-compose logs app
docker-compose logs postgres
```

### **Performance Optimization**

**Database**
- Ensure indexes are created (included in schema.sql)
- Regular VACUUM and ANALYZE operations
- Connection pooling configuration

**Application**
- Enable gzip compression
- Static file caching
- Session store optimization (Redis)

**System**
- Adequate RAM allocation (2GB+ recommended)  
- SSD storage for database
- Regular backup procedures

## 🔒 Security Considerations

### **Production Deployment**
1. **Change Default Credentials**: Update admin password immediately
2. **Secure Session Secret**: Use cryptographically strong session secret
3. **Database Security**: Use strong database passwords and limit access
4. **HTTPS**: Configure SSL/TLS certificates
5. **Firewall**: Restrict access to necessary ports only
6. **Updates**: Keep dependencies updated regularly

### **Backup Strategy**
```bash
# Database backup
pg_dump -h localhost -U inventory_user inventory_db > backup.sql

# Restore database
psql -h localhost -U inventory_user inventory_db < backup.sql

# File backup
tar -czf uploads_backup.tar.gz uploads/
```

## 📈 Monitoring

### **Health Monitoring**
- **Endpoint**: `/health` for uptime checks
- **Docker Health**: Built-in container health checks
- **Database**: Connection status monitoring

### **Logging**
- **Application Logs**: Console output with timestamps
- **Access Logs**: HTTP request logging
- **Error Tracking**: Comprehensive error handling

### **Metrics**
- **Performance**: Response time monitoring
- **Usage**: User activity tracking
- **Resources**: Memory and CPU utilization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Express.js Community**: Web framework foundation
- **PostgreSQL Team**: Robust database system
- **Docker**: Containerization technology
- **FontAwesome**: Icon library
- **Bootstrap**: UI component framework

## 📞 Support

For support and questions:
- 📧 Email: support@your-domain.com
- 🐛 Issues: GitHub Issues page
- 📚 Documentation: Wiki pages
- 💬 Community: Discord/Slack channel

---

**🎉 Ready to manage your IT assets like a pro!**

> Built with ❤️ for IT professionals who need reliable asset tracking and comprehensive reporting capabilities.