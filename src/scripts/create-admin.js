import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const ADMIN_PERMISSIONS = [
  'manage_products', 'manage_orders', 'manage_users', 'manage_categories',
  'manage_coupons', 'manage_inventory', 'view_analytics', 'manage_settings',
  'process_refunds', 'manage_support', 'view_reports', 'manage_shipping'
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    email: process.env.ADMIN_EMAIL || 'admin@ansartehzeeb.com',
    password: process.env.ADMIN_PASSWORD || 'AdminPass123',
    name: process.env.ADMIN_NAME || 'Admin User',
    role: process.env.ADMIN_ROLE || 'super_admin'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) options.email = args[++i];
    else if (arg === '--password' && args[i + 1]) options.password = args[++i];
    else if (arg === '--name' && args[i + 1]) options.name = args[++i];
    else if (arg === '--role' && args[i + 1]) options.role = args[++i];
  }

  return options;
};

const createAdmin = async () => {
  const { email, password, name, role } = parseArgs();

  if (!['admin', 'super_admin'].includes(role)) {
    console.error('[Create Admin] Role must be "admin" or "super_admin"');
    process.exit(1);
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
    console.error('[Create Admin] Password must be at least 6 characters with uppercase, lowercase, and a number.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce');
    console.log(`[Database] Connected: ${mongoose.connection.host}`);

    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (user) {
      user.name = name;
      user.role = role;
      user.isVerified = true;
      user.permissions = ADMIN_PERMISSIONS;
      user.password = password;
      await user.save();

      console.log('\n[Create Admin] Existing user promoted to admin.');
    } else {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        role,
        isVerified: true,
        permissions: ADMIN_PERMISSIONS
      });

      console.log('\n[Create Admin] New admin user created.');
    }

    console.log(`  Email: ${user.email}`);
    console.log(`  Name:  ${user.name}`);
    console.log(`  Role:  ${user.role}`);
    console.log(`  Password: ${password}`);
    console.log('\nLog in at http://localhost:5173/login then open /admin');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Create Admin Error]', error.message);
    process.exit(1);
  }
};

createAdmin();
