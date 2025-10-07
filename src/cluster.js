const cluster = require('cluster');
const os = require('os');
const path = require('path');

// Number of CPU cores
const numCPUs = os.cpus().length;

// Get number of workers from environment or use CPU count
const numWorkers = process.env.CLUSTER_WORKERS ?
  parseInt(process.env.CLUSTER_WORKERS) :
  Math.min(numCPUs, 4); // Max 4 workers to prevent resource exhaustion

if (cluster.isMaster) {
  console.log(`🚀 Master process ${process.pid} is running`);
  console.log(`💻 CPU cores available: ${numCPUs}`);
  console.log(`⚡ Starting ${numWorkers} worker processes...`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork();
    console.log(`👷 Worker ${worker.process.pid} started`);
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.process.pid} died (${signal || code})`);

    // Don't restart if it was an intentional shutdown
    if (!worker.exitedAfterDisconnect) {
      console.log('🔄 Starting a new worker...');
      const newWorker = cluster.fork();
      console.log(`👷 New worker ${newWorker.process.pid} started`);
    }
  });

  // Handle master process signals
  process.on('SIGTERM', () => {
    console.log('🛑 Master received SIGTERM, shutting down gracefully...');

    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }

    // Force exit after 30 seconds
    setTimeout(() => {
      console.log('⏰ Force exit after 30 seconds');
      process.exit(1);
    }, 30000);
  });

  process.on('SIGINT', () => {
    console.log('🛑 Master received SIGINT, shutting down gracefully...');

    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGINT');
    }

    // Force exit after 30 seconds
    setTimeout(() => {
      console.log('⏰ Force exit after 30 seconds');
      process.exit(1);
    }, 30000);
  });

  // Monitor worker health
  setInterval(() => {
    const workers = Object.keys(cluster.workers).length;
    if (workers < numWorkers) {
      console.log(`⚠️  Only ${workers}/${numWorkers} workers running, starting new worker...`);
      const newWorker = cluster.fork();
      console.log(`👷 New worker ${newWorker.process.pid} started`);
    }
  }, 5000);

} else {
  // Worker process
  console.log(`👷 Worker ${process.pid} starting...`);

  // Start the application
  require('./app.js');

  console.log(`✅ Worker ${process.pid} ready`);
}

// Handle uncaught exceptions in master
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception in master:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection in master at:', promise, 'reason:', reason);
  process.exit(1);
});
