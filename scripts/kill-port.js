import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Kill process using a specific port on Windows or Unix-like systems
 * @param {number} port - The port number to free up
 */
async function killPort(port) {
  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows: Find and kill process using the port
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        
        if (stdout) {
          const lines = stdout.trim().split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && !isNaN(pid)) {
              pids.add(pid);
            }
          });

          for (const pid of pids) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`✓ Killed process ${pid} using port ${port}`);
            } catch (err) {
              // Process might have already been killed
              if (!err.message.includes('not found')) {
                console.warn(`⚠ Could not kill process ${pid}: ${err.message}`);
              }
            }
          }
        } else {
          console.log(`✓ No process found using port ${port}`);
        }
      } catch (err) {
        // No process found on port
        console.log(`✓ Port ${port} is available`);
      }
    } else {
      // Unix/Linux/Mac: Use lsof and kill
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid}`);
          console.log(`✓ Killed process ${pid} using port ${port}`);
        }
      } catch (err) {
        // No process found on port
        console.log(`✓ Port ${port} is available`);
      }
    }
  } catch (error) {
    console.error(`✗ Error while trying to free port ${port}:`, error.message);
  }
}

// If running directly (not imported)
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const port = process.argv[2] || process.env.PORT || 5000;
  console.log(`Attempting to free port ${port}...`);
  killPort(port).then(() => {
    console.log('Done!');
    process.exit(0);
  });
}

export default killPort;
