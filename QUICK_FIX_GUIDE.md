# 🚨 Quick Fix Guide - Database Column Errors

## **Problem**: Column does not exist errors

If you're seeing errors like:
- `column p.status_id does not exist`
- `column p.model does not exist`
- `title is not defined` in error pages

## 🔧 **Quick Solution**

### **Option 1: Automated Fix (Recommended)**
```bash
# Run the database repair script
npm run repair-db
```

### **Option 2: Manual Migration**
```bash
# Run just the migration
npm run migrate
```

### **Option 3: Full Database Reset**
```bash
# If you want to start fresh (WARNING: This will delete all data!)
npm run init-db
```

## 📋 **What the Repair Script Does**

1. ✅ **Adds Missing Columns**:
   - `model` column to printers and PDAs tables
   - `cost` column to printers and PDAs tables  
   - `status_id` column to printers and PDAs tables

2. ✅ **Creates Missing Tables**:
   - `sim_cards` table with all required columns
   - `sim_card_history` table for audit trails

3. ✅ **Updates Sample Data**:
   - Adds model names to existing printers
   - Adds costs to existing equipment
   - Sets appropriate status values
   - Creates additional clients for different equipment types

4. ✅ **Fixes User Settings**:
   - Ensures `settings` column exists in users table
   - Converts to proper JSONB format
   - Fixes theme persistence issues

## 🎯 **After Running the Fix**

1. **Restart the application**:
   ```bash
   npm start
   ```

2. **Test all pages**:
   - ✅ Printers page should load without errors
   - ✅ PDAs page should show model, cost, and status
   - ✅ SIM Cards page should work completely
   - ✅ User settings should save properly
   - ✅ Theme changes should persist

3. **Verify data**:
   - Check that printers show costs and models
   - Verify PDAs have status indicators
   - Confirm SIM cards are properly linked
   - Test theme switching in user settings

## 🐳 **For Docker Users**

If using Docker, rebuild the containers:
```bash
# Stop current containers
docker-compose down

# Rebuild and start
docker-compose up --build -d

# Check logs
docker-compose logs -f app
```

## 🔍 **Troubleshooting**

### **If repair script fails**:
1. Check database connection
2. Ensure PostgreSQL is running
3. Verify user has ALTER TABLE permissions

### **If pages still show errors**:
1. Clear browser cache
2. Restart Node.js application
3. Check that all migrations completed successfully

### **If theme doesn't persist**:
1. Check browser cookies are enabled
2. Verify database `settings` column is JSONB type
3. Test with different browsers

## 📞 **Need Help?**

If you're still experiencing issues:

1. **Check the logs**:
   ```bash
   # For standard installation
   npm start
   
   # For Docker
   docker-compose logs -f
   ```

2. **Verify database structure**:
   ```bash
   # Connect to database and check tables
   psql -h localhost -U your_user -d inventory_db
   \d printers
   \d pdas
   \d sim_cards
   ```

3. **Run health check**:
   ```bash
   curl http://localhost:3000/health
   ```

## ✅ **Expected Results After Fix**

- **Printers Page**: Shows supplier, model, cost, status, employee, client
- **PDAs Page**: Shows serial, model, cost, status, SIM count, client
- **SIM Cards Page**: Shows SIM number, carrier, cost, status, assigned PDA
- **User Settings**: Theme changes apply immediately and persist
- **All Pages**: Load within main-content with consistent styling

---

**🎉 Your IT Asset Manager should now be fully functional!**