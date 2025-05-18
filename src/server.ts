import mongoose from 'mongoose';
import { App } from './app';

class Server {
  private readonly PORT: number;
  private readonly MONGO_URI: string;
  private app: App;

  constructor() {
    this.PORT = parseInt(process.env.PORT || '5000');
    this.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/digitalkrishi';
    this.app = new App();

    // Handle uncaught exceptions
    this.setupExceptionHandling();
  }

  private setupExceptionHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('❌ UNCAUGHT EXCEPTION:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      console.error(
        '❌ UNHANDLED REJECTION:',
        reason instanceof Error ? reason : new Error(String(reason))
      );
      process.exit(1);
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      console.info('SIGTERM received. Shutting down gracefully');
      process.exit(0);
    });
  }

  public async start(): Promise<void> {
    try {
      // Connect to MongoDB with retry logic
      await this.connectToMongoDB();

      // Start Express server
      this.app.app.listen(this.PORT, () => {
        console.log(`🚀 Server is running on port ${this.PORT}`);
        console.log(`🌐 API available at http://localhost:${this.PORT}/api/`);
      });
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }

  private async connectToMongoDB(retries = 5, delay = 5000): Promise<void> {
    try {
      console.log(`Connecting to MongoDB: ${this.MONGO_URI}`);
      await mongoose.connect(this.MONGO_URI);
      console.log('✅ Connected to MongoDB successfully');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);

      if (retries > 0) {
        console.log(`Retrying connection in ${delay / 1000} seconds... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connectToMongoDB(retries - 1, delay);
      } else {
        console.error('❌ Failed to connect to MongoDB after multiple retries');
        throw error;
      }
    }
  }
}

// Start the server
const server = new Server();
server.start().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
